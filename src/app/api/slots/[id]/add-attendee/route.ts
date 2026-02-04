import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { addAttendeeToEvent, sendEmail, updateCalendarEventDescription } from '@/lib/google';
import { generateConfirmationEmailHtml, escapeHtml } from '@/lib/email-html';
import { generateGoogleCalendarUrl, generateOutlookUrl } from '@/lib/ical';
import { createEmailVariables } from '@/lib/email-templates';
import { CommonErrors, safeParseJSON } from '@/lib/errors';
import { bookingLogger, calendarLogger } from '@/lib/logger';
import { parseISO, format } from 'date-fns';
import crypto from 'crypto';

// POST add an attendee to an existing slot (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: CommonErrors.UNAUTHORIZED }, { status: 401 });
  }

  const { id: slotId } = await params;
  const body = await safeParseJSON<Record<string, any>>(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { first_name, last_name, email, notify } = body;

  if (!first_name || !last_name || !email) {
    return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 });
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Fetch slot with event
  const { data: slot, error: slotError } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events!event_id(*)
    `)
    .eq('id', slotId)
    .single();

  if (slotError || !slot) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Verify the requesting admin hosts this event
  const eventId = slot.event_id;
  const { data: adminRecord } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  const { data: primaryEvent } = await supabase
    .from('oh_events')
    .select('id')
    .eq('id', eventId)
    .eq('host_email', session.email)
    .single();

  let isCoHost = false;
  if (!primaryEvent && adminRecord) {
    const { data: coHostEntry } = await supabase
      .from('oh_event_hosts')
      .select('id')
      .eq('event_id', eventId)
      .eq('admin_id', adminRecord.id)
      .single();
    isCoHost = !!coHostEntry;
  }

  if (!primaryEvent && !isCoHost) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Create booking via atomic procedure
  const manageToken = crypto.randomBytes(32).toString('hex');

  const { data: atomicResult, error: atomicError } = await supabase.rpc(
    'create_booking_atomic',
    {
      p_slot_id: slotId,
      p_first_name: first_name.trim(),
      p_last_name: last_name.trim(),
      p_email: email.toLowerCase().trim(),
      p_manage_token: manageToken,
      p_question_responses: {},
      p_attendee_timezone: null,
      p_assigned_host_id: null,
      p_phone: null,
      p_sms_consent: false,
      p_guest_emails: [],
    }
  );

  if (atomicError) {
    console.error('[Slot/AddAttendee] Atomic booking creation failed:', atomicError);
    return NextResponse.json({ error: 'Unable to create booking. Please try again.' }, { status: 500 });
  }

  if (!atomicResult?.success) {
    const errorCode = atomicResult?.error_code;
    if (errorCode === 'DUPLICATE_BOOKING') {
      return NextResponse.json({ error: 'This person is already booked for this session' }, { status: 400 });
    }
    return NextResponse.json({ error: atomicResult?.error || 'Unable to create booking' }, { status: 400 });
  }

  const bookingId = atomicResult.booking_id;
  const isWaitlisted = atomicResult.is_waitlisted || false;

  bookingLogger.info('Admin added attendee to slot', {
    operation: 'adminAddAttendee',
    bookingId,
    metadata: {
      slotId,
      attendeeEmail: email.toLowerCase(),
      addedBy: session.email,
      isWaitlisted,
    },
  });

  // Get admin for Google API access
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id, name, email, google_access_token, google_refresh_token')
    .eq('email', slot.event.host_email)
    .single();

  // Add to Google Calendar (always, to keep calendar accurate)
  if (admin?.google_access_token && admin?.google_refresh_token && slot.google_event_id && !isWaitlisted) {
    try {
      // Update calendar description with manage link BEFORE adding attendee,
      // so Google's invitation email includes the link
      if (slot.event.meeting_type !== 'webinar') {
        try {
          const manageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/manage/${manageToken}`;
          const baseDesc = slot.event.description || '';
          const updatedDesc = slot.event.max_attendees === 1
            ? `${baseDesc}\n\n---\nReschedule or cancel: ${manageUrl}`
            : `${baseDesc}\n\n---\nNeed to reschedule or cancel? Use the link in your confirmation email.`;

          await updateCalendarEventDescription(
            admin.google_access_token,
            admin.google_refresh_token,
            slot.google_event_id,
            updatedDesc
          );
        } catch (descErr) {
          console.error('[Slot/AddAttendee] Failed to update calendar description:', descErr);
        }
      }

      await addAttendeeToEvent(
        admin.google_access_token,
        admin.google_refresh_token,
        slot.google_event_id,
        email.toLowerCase()
      );

      await supabase
        .from('oh_bookings')
        .update({ calendar_invite_sent_at: new Date().toISOString() })
        .eq('id', bookingId);

      calendarLogger.info('Added attendee to calendar event (admin add)', {
        operation: 'adminAddAttendee',
        bookingId,
        attendeeEmail: email.toLowerCase(),
        metadata: { googleEventId: slot.google_event_id },
      });
    } catch (err) {
      console.error('[Slot/AddAttendee] Failed to add attendee to calendar:', err);
    }
  }

  // Send confirmation email if admin chose to notify
  if (notify === true && admin?.google_access_token && admin?.google_refresh_token && !isWaitlisted) {
    try {
      const event = slot.event;
      const emailTimezone = event.display_timezone || event.timezone || 'America/New_York';

      const variables = createEmailVariables(
        { first_name: first_name.trim(), last_name: last_name.trim(), email: email.toLowerCase() },
        event,
        slot,
        emailTimezone,
        undefined,
        null
      );

      const manageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/manage/${manageToken}`;

      const calendarEvent = {
        title: event.name,
        description: `${event.description || ''}\n\n${slot.google_meet_link ? `Join: ${slot.google_meet_link}` : ''}`.trim(),
        location: slot.google_meet_link || 'Google Meet',
        startTime: parseISO(slot.start_time),
        endTime: parseISO(slot.end_time),
      };

      const googleCalUrl = generateGoogleCalendarUrl(calendarEvent);
      const outlookUrl = generateOutlookUrl(calendarEvent);
      const icalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/manage/${manageToken}/ical`;

      const htmlBody = generateConfirmationEmailHtml({
        firstName: first_name.trim(),
        eventName: event.name,
        hostName: admin.name || event.host_name || 'Your Host',
        date: variables.date,
        time: variables.time,
        timezoneAbbr: variables.timezone_abbr,
        timezone: variables.timezone,
        meetLink: slot.google_meet_link,
        manageUrl,
        googleCalUrl,
        outlookUrl,
        icalUrl,
        eventDescription: event.description,
      });

      await sendEmail(
        admin.google_access_token,
        admin.google_refresh_token,
        {
          to: email.toLowerCase(),
          subject: `Confirmed: ${event.name}`,
          replyTo: event.host_email,
          from: event.host_email,
          htmlBody,
        }
      );

      await supabase
        .from('oh_bookings')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', bookingId);
    } catch (err) {
      console.error('[Slot/AddAttendee] Failed to send confirmation email:', err);
    }
  }

  return NextResponse.json({
    success: true,
    booking_id: bookingId,
    is_waitlisted: isWaitlisted,
  });
}
