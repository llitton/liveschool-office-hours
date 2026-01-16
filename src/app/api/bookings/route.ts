import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { addAttendeeToEvent, sendEmail } from '@/lib/google';
import {
  processTemplate,
  createEmailVariables,
  defaultTemplates,
  htmlifyEmailBody,
} from '@/lib/email-templates';
import { generateGoogleCalendarUrl, generateOutlookUrl } from '@/lib/ical';
import { findOrCreateContact, logMeetingActivity } from '@/lib/hubspot';
import { notifyNewBooking } from '@/lib/slack';
import { matchPrepResources, formatResourcesForEmail } from '@/lib/prep-matcher';
import { selectNextHost, getParticipatingHosts } from '@/lib/round-robin';
import type { OHAdmin } from '@/types';
import { parseISO, format, addHours, addDays, isBefore, isAfter, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import crypto from 'crypto';

function generateManageToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Helper to sync booking to HubSpot
async function syncBookingToHubSpot(
  booking: { id: string; status?: string },
  event: { name: string; description?: string },
  slot: { start_time: string; end_time: string; google_meet_link?: string },
  firstName: string,
  lastName: string,
  email: string,
  supabase: ReturnType<typeof getServiceSupabase>
) {
  try {
    // Find or create HubSpot contact
    const contact = await findOrCreateContact(email, firstName, lastName);
    if (!contact) {
      return;
    }

    // Update booking with HubSpot contact ID
    await supabase
      .from('oh_bookings')
      .update({ hubspot_contact_id: contact.id })
      .eq('id', booking.id);

    // Log meeting activity
    await logMeetingActivity(
      contact.id,
      {
        id: booking.id,
        attendee_email: email,
        attendee_name: `${firstName} ${lastName}`,
        status: booking.status || 'booked',
      },
      event,
      slot
    );
  } catch (err) {
    console.error('Failed to sync booking to HubSpot:', err);
  }
}

// POST create booking (public)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slot_id, first_name, last_name, email, question_responses, attendee_timezone, preferred_host_id } = body;

  if (!slot_id || !first_name || !last_name || !email) {
    return NextResponse.json(
      { error: 'slot_id, first_name, last_name, and email are required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get the slot with event and booking count
  const { data: slot, error: slotError } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(count)
    `)
    .eq('id', slot_id)
    .single();

  if (slotError || !slot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }

  if (slot.is_cancelled) {
    return NextResponse.json(
      { error: 'This time slot is no longer available' },
      { status: 400 }
    );
  }

  // === BOOKING CONSTRAINT VALIDATION ===
  const now = new Date();
  const slotStart = parseISO(slot.start_time);
  const event = slot.event;

  // 1. Validate minimum notice
  const minNoticeHours = event.min_notice_hours ?? 24;
  const earliestBookable = addHours(now, minNoticeHours);
  if (isBefore(slotStart, earliestBookable)) {
    return NextResponse.json(
      { error: `This slot requires ${minNoticeHours} hours advance notice.` },
      { status: 400 }
    );
  }

  // 2. Validate booking window
  const bookingWindowDays = event.booking_window_days ?? 60;
  const latestBookable = addDays(now, bookingWindowDays);
  if (isAfter(slotStart, latestBookable)) {
    return NextResponse.json(
      { error: `Bookings can only be made up to ${bookingWindowDays} days in advance.` },
      { status: 400 }
    );
  }

  // 3. Validate daily booking limit
  if (event.max_daily_bookings) {
    const dayStart = startOfDay(slotStart);
    const dayEnd = endOfDay(slotStart);

    const { count: dailyCount } = await supabase
      .from('oh_bookings')
      .select('id, slot:oh_slots!inner(event_id, start_time)', { count: 'exact', head: true })
      .eq('slot.event_id', event.id)
      .gte('slot.start_time', dayStart.toISOString())
      .lte('slot.start_time', dayEnd.toISOString())
      .is('cancelled_at', null);

    if ((dailyCount || 0) >= event.max_daily_bookings) {
      return NextResponse.json(
        { error: `This event has reached its daily booking limit of ${event.max_daily_bookings}.` },
        { status: 400 }
      );
    }
  }

  // 4. Validate weekly booking limit
  if (event.max_weekly_bookings) {
    const weekStart = startOfWeek(slotStart, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(slotStart, { weekStartsOn: 0 });

    const { count: weeklyCount } = await supabase
      .from('oh_bookings')
      .select('id, slot:oh_slots!inner(event_id, start_time)', { count: 'exact', head: true })
      .eq('slot.event_id', event.id)
      .gte('slot.start_time', weekStart.toISOString())
      .lte('slot.start_time', weekEnd.toISOString())
      .is('cancelled_at', null);

    if ((weeklyCount || 0) >= event.max_weekly_bookings) {
      return NextResponse.json(
        { error: `This event has reached its weekly booking limit of ${event.max_weekly_bookings}.` },
        { status: 400 }
      );
    }
  }
  // === END CONSTRAINT VALIDATION ===

  // === ROUND-ROBIN HOST ASSIGNMENT ===
  let assignedHost: OHAdmin | null = null;
  let assignedHostId: string | null = null;

  if (event.meeting_type === 'round_robin') {
    const hostIds = await getParticipatingHosts(event.id);

    if (hostIds.length === 0) {
      return NextResponse.json(
        { error: 'No hosts available for this event' },
        { status: 400 }
      );
    }

    // Check if a preferred host was specified (e.g., from routing forms)
    if (preferred_host_id && hostIds.includes(preferred_host_id)) {
      // Use the preferred host if they're a valid host for this event
      const { data: preferredHostData } = await supabase
        .from('oh_admins')
        .select('*')
        .eq('id', preferred_host_id)
        .single();

      if (preferredHostData) {
        assignedHost = preferredHostData;
        assignedHostId = preferred_host_id;
        console.log(`Using preferred host ${preferredHostData.email} from routing form`);
      }
    }

    // Fall back to round-robin selection if no preferred host was assigned
    if (!assignedHost) {
      const config = {
        strategy: event.round_robin_strategy || 'cycle',
        period: event.round_robin_period || 'week',
        hostIds,
      };

      const slotStartTime = parseISO(slot.start_time);
      const slotEndTime = parseISO(slot.end_time);

      const assignment = await selectNextHost(
        event.id,
        slotStartTime,
        slotEndTime,
        config as { strategy: 'cycle' | 'least_bookings' | 'availability_weighted'; period: 'day' | 'week' | 'month' | 'all_time'; hostIds: string[] }
      );

      if (!assignment) {
        return NextResponse.json(
          { error: 'All hosts are currently unavailable for this time slot' },
          { status: 400 }
        );
      }

      assignedHost = assignment.host;
      assignedHostId = assignment.hostId;
      console.log(`Round-robin assigned host ${assignedHost.email} to booking (${assignment.reason})`);
    }

    // Update slot with assigned host if not already set
    if (!slot.assigned_host_id) {
      await supabase
        .from('oh_slots')
        .update({ assigned_host_id: assignedHostId })
        .eq('id', slot_id);
    }
  }
  // === END ROUND-ROBIN ===

  // Check if slot is full
  const bookingCount = slot.bookings?.[0]?.count || 0;
  if (bookingCount >= slot.event.max_attendees) {
    return NextResponse.json(
      { error: 'This time slot is full' },
      { status: 400 }
    );
  }

  // Check if user already booked this slot
  const { data: existingBooking } = await supabase
    .from('oh_bookings')
    .select('id')
    .eq('slot_id', slot_id)
    .eq('email', email.toLowerCase())
    .is('cancelled_at', null)
    .single();

  if (existingBooking) {
    return NextResponse.json(
      { error: 'You have already booked this time slot' },
      { status: 400 }
    );
  }

  // Generate manage token for attendee self-service
  const manage_token = generateManageToken();

  // Determine booking status based on require_approval setting
  const bookingStatus = event.require_approval ? 'pending_approval' : 'confirmed';

  // Create the booking
  const { data: booking, error: bookingError } = await supabase
    .from('oh_bookings')
    .insert({
      slot_id,
      first_name,
      last_name,
      email: email.toLowerCase(),
      manage_token,
      question_responses: question_responses || {},
      status: bookingStatus,
      attendee_timezone: attendee_timezone || null,
      assigned_host_id: assignedHostId,
    })
    .select()
    .single();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  // Get admin with tokens to send emails and add to calendar
  // For round-robin events, use the assigned host; otherwise use the event's host
  let admin: OHAdmin | null = assignedHost;

  if (!admin) {
    const { data: eventAdmin } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', slot.event.host_email)
      .single();
    admin = eventAdmin;
  }

  if (admin?.google_access_token && admin?.google_refresh_token) {
    // Only add to calendar if booking is confirmed (not pending approval)
    if (slot.google_event_id && bookingStatus === 'confirmed') {
      try {
        await addAttendeeToEvent(
          admin.google_access_token,
          admin.google_refresh_token,
          slot.google_event_id,
          email.toLowerCase()
        );

        await supabase
          .from('oh_bookings')
          .update({ calendar_invite_sent_at: new Date().toISOString() })
          .eq('id', booking.id);
      } catch (err) {
        console.error('Failed to add attendee to calendar:', err);
      }
    }

    // Send confirmation email using templates
    try {
      // Match prep resources based on booking question responses
      const matchedResources = await matchPrepResources(
        slot.event_id,
        question_responses || {}
      );
      const prepResourcesHtml = formatResourcesForEmail(matchedResources);

      // Track which resources were sent
      if (matchedResources.length > 0) {
        await supabase
          .from('oh_bookings')
          .update({
            prep_resources_sent: matchedResources.map((r) => r.id),
          })
          .eq('id', booking.id);
      }

      // Use attendee's timezone for email formatting, fall back to event's display timezone
      const emailTimezone = attendee_timezone || slot.event.display_timezone || 'America/New_York';

      const variables = createEmailVariables(
        { first_name, last_name, email },
        { ...slot.event, meeting_type: event.meeting_type },
        slot,
        emailTimezone,
        undefined,
        assignedHost ? { name: assignedHost.name, email: assignedHost.email } : null
      );

      const subject = processTemplate(
        slot.event.confirmation_subject || defaultTemplates.confirmation_subject,
        variables
      );

      const bodyText = processTemplate(
        slot.event.confirmation_body || defaultTemplates.confirmation_body,
        variables
      );

      // Generate calendar URLs
      const calendarEvent = {
        title: slot.event.name,
        description: `${slot.event.description || ''}\n\n${slot.google_meet_link ? `Join: ${slot.google_meet_link}` : ''}`.trim(),
        location: slot.google_meet_link || 'Google Meet',
        startTime: parseISO(slot.start_time),
        endTime: parseISO(slot.end_time),
      };

      const googleCalUrl = generateGoogleCalendarUrl(calendarEvent);
      const outlookUrl = generateOutlookUrl(calendarEvent);
      const manageUrl = `${process.env.APP_URL || 'http://localhost:3000'}/manage/${manage_token}`;
      const icalUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/manage/${manage_token}/ical`;

      // Extract the user's question/topic if provided
      const userTopic = question_responses?.question || question_responses?.response || question_responses?.topic || null;

      const htmlBody = `
        <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
          ${htmlifyEmailBody(bodyText)}

          ${userTopic ? `
            <div style="background: #EEF0FF; border-left: 4px solid #6F71EE; padding: 16px; border-radius: 0 8px 8px 0; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #101E57; font-size: 14px; font-weight: 600;">What you want to discuss:</h3>
              <p style="color: #667085; margin-bottom: 0; font-style: italic;">"${userTopic}"</p>
            </div>
          ` : ''}

          ${slot.event.description ? `
            <div style="background: #F6F6F9; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #101E57;">About this session:</h3>
              <p style="color: #667085;">${slot.event.description}</p>
            </div>
          ` : ''}

          ${slot.google_meet_link ? `
            <div style="background: #6F71EE; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <a href="${slot.google_meet_link}" style="color: white; text-decoration: none; font-weight: 600;">
                Join Google Meet →
              </a>
            </div>
          ` : ''}

          ${slot.event.prep_materials ? `
            <div style="background: #F6F6F9; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #101E57;">Preparation Materials</h3>
              <p style="color: #667085; white-space: pre-wrap;">${slot.event.prep_materials}</p>
            </div>
          ` : ''}

          ${prepResourcesHtml}

          <div style="background: #F6F6F9; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #101E57;">Add to Calendar</h3>
            <p style="margin-bottom: 12px;">
              <a href="${googleCalUrl}" target="_blank" style="color: #6F71EE; text-decoration: none; margin-right: 16px;">Google Calendar</a>
              <a href="${outlookUrl}" target="_blank" style="color: #6F71EE; text-decoration: none; margin-right: 16px;">Outlook</a>
              <a href="${icalUrl}" style="color: #6F71EE; text-decoration: none;">Apple Calendar (.ics)</a>
            </p>
          </div>

          <div style="background: #F6F6F9; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="color: #667085; margin: 0 0 12px 0; font-size: 14px;">
              Something come up? No problem.
            </p>
            <a href="${manageUrl}" style="display: inline-block; background: #6F71EE; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Reschedule or Cancel
            </a>
          </div>

          <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; margin-top: 20px; text-align: center;">
            <p style="color: #98A2B3; font-size: 12px; margin: 0;">
              Sent from Connect with LiveSchool
            </p>
          </div>
        </div>
      `;

      await sendEmail(
        admin.google_access_token,
        admin.google_refresh_token,
        {
          to: email,
          subject,
          replyTo: slot.event.host_email,
          htmlBody,
        }
      );

      await supabase
        .from('oh_bookings')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', booking.id);
    } catch (err) {
      console.error('Failed to send confirmation email:', err);
    }
  }

  // Sync with HubSpot (non-blocking)
  syncBookingToHubSpot(booking, slot.event, slot, first_name, last_name, email, supabase).catch(
    (err) => console.error('HubSpot sync failed:', err)
  );

  // Send Slack notification (non-blocking)
  notifyNewBooking(
    {
      id: booking.id,
      attendee_name: `${first_name} ${last_name}`,
      attendee_email: email,
      response_text: question_responses?.question || question_responses?.response,
    },
    { name: slot.event.name, slug: slot.event.slug },
    {
      start_time: slot.start_time,
      end_time: slot.end_time,
      google_meet_link: slot.google_meet_link,
    }
  ).catch((err) => console.error('Slack notification failed:', err));

  return NextResponse.json({
    ...booking,
    event: slot.event,
    slot: {
      start_time: slot.start_time,
      end_time: slot.end_time,
      google_meet_link: slot.google_meet_link,
    },
  });
}

// GET bookings for a slot (admin only via query param check)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const slotId = searchParams.get('slotId');

  if (!slotId) {
    return NextResponse.json({ error: 'slotId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data: bookings, error } = await supabase
    .from('oh_bookings')
    .select('*')
    .eq('slot_id', slotId)
    .is('cancelled_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(bookings);
}
