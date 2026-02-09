import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail, removeAttendeeFromEvent, createCalendarEvent, deleteCalendarEvent } from '@/lib/google';
import { CommonErrors, safeParseJSON } from '@/lib/errors';
import {
  processTemplate,
  createEmailVariables,
  defaultTemplates,
  htmlifyEmailBody,
} from '@/lib/email-templates';
import { generateCancellationEmailHtml, escapeHtml } from '@/lib/email-html';
import { updateMeetingOutcome } from '@/lib/hubspot';
import { calendarLogger, bookingLogger } from '@/lib/logger';
import { format, parseISO, addMinutes, addHours, addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getTimezoneAbbr } from '@/lib/timezone';
import { getAvailableSlots, getCollectiveAvailableSlots, syncGoogleCalendarBusy, checkTimeAvailability } from '@/lib/availability';
import { getParticipatingHosts } from '@/lib/round-robin';

// GET booking by manage token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getServiceSupabase();

  // Get booking with slot and event
  // Note: response narrows fields at lines 62-69 before returning to client
  const { data: booking, error } = await supabase
    .from('oh_bookings')
    .select(`
      *,
      slot:oh_slots!slot_id(
        *,
        event:oh_events!event_id(*)
      )
    `)
    .eq('manage_token', token)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Get available slots for rescheduling using same dynamic generation as booking page
  const event = booking.slot.event;
  const now = new Date();
  const minNoticeHours = event.min_notice_hours ?? 0;
  const bookingWindowDays = event.booking_window_days ?? 60;
  const earliestBookable = addHours(now, minNoticeHours);
  const latestBookable = addDays(now, bookingWindowDays);

  let openSlots: { id: string; event_id: string; start_time: string; end_time: string; is_dynamic: boolean }[] = [];

  if (event.meeting_type === 'webinar') {
    // Webinars use pre-created slots
    const { data: availableSlots } = await supabase
      .from('oh_slots')
      .select(`
        id, event_id, start_time, end_time, google_meet_link, is_cancelled,
        bookings:oh_bookings!slot_id(count)
      `)
      .eq('event_id', event.id)
      .eq('is_cancelled', false)
      .neq('id', booking.slot_id)
      .gt('start_time', now.toISOString())
      .is('bookings.cancelled_at', null)
      .order('start_time', { ascending: true });

    openSlots = (availableSlots || [])
      .filter((s: { bookings: { count: number }[] }) => {
        const bookingCount = s.bookings?.[0]?.count || 0;
        return bookingCount < event.max_attendees;
      })
      .map((s: { id: string; event_id: string; start_time: string; end_time: string }) => ({
        id: s.id,
        event_id: s.event_id,
        start_time: s.start_time,
        end_time: s.end_time,
        is_dynamic: false,
      }));
  } else {
    // Non-webinars: generate dynamic availability (same as booking page)
    const { data: adminData } = await supabase
      .from('oh_admins')
      .select('id, google_access_token, google_refresh_token')
      .eq('email', event.host_email)
      .single();

    if (adminData) {
      // Sync calendar busy times
      if (adminData.google_access_token && adminData.google_refresh_token) {
        try {
          await syncGoogleCalendarBusy(
            adminData.id,
            adminData.google_access_token,
            adminData.google_refresh_token,
            earliestBookable,
            latestBookable
          );
        } catch (err) {
          console.warn('Failed to sync Google Calendar busy times for reschedule:', err);
        }
      }

      const bufferBefore = event.buffer_before || 0;
      const bufferAfter = event.buffer_after || 0;
      const startTimeIncrement = event.start_time_increment || 30;
      let dynamicSlots: { start: Date; end: Date }[] = [];

      if (event.meeting_type === 'collective') {
        const collectiveHosts = await getParticipatingHosts(event.id);
        if (collectiveHosts.length > 0) {
          dynamicSlots = await getCollectiveAvailableSlots(
            collectiveHosts,
            event.duration_minutes,
            earliestBookable,
            latestBookable,
            event.id,
            startTimeIncrement,
            event.ignore_busy_blocks ?? false
          );
        }
      } else if (event.meeting_type === 'round_robin') {
        const participatingHosts = await getParticipatingHosts(event.id);
        if (participatingHosts.length === 0) {
          dynamicSlots = await getAvailableSlots(
            adminData.id, event.duration_minutes, bufferBefore, bufferAfter,
            earliestBookable, latestBookable, event.id, startTimeIncrement,
            event.ignore_busy_blocks ?? false
          );
        } else {
          const allHostSlots = await Promise.all(
            participatingHosts.map(async (hostId) => {
              try {
                return await getAvailableSlots(
                  hostId, event.duration_minutes, bufferBefore, bufferAfter,
                  earliestBookable, latestBookable, event.id, startTimeIncrement,
                  event.ignore_busy_blocks ?? false
                );
              } catch { return []; }
            })
          );
          const slotMap = new Map<string, { start: Date; end: Date }>();
          for (const hostSlots of allHostSlots) {
            for (const slot of hostSlots) {
              const key = slot.start.toISOString();
              if (!slotMap.has(key)) slotMap.set(key, slot);
            }
          }
          dynamicSlots = Array.from(slotMap.values()).sort(
            (a, b) => a.start.getTime() - b.start.getTime()
          );
        }
      } else {
        dynamicSlots = await getAvailableSlots(
          adminData.id, event.duration_minutes, bufferBefore, bufferAfter,
          earliestBookable, latestBookable, event.id, startTimeIncrement,
          event.ignore_busy_blocks ?? false
        );
      }

      // Filter out the current booking's time slot
      const currentStart = new Date(booking.slot.start_time).getTime();
      openSlots = dynamicSlots
        .filter((s) => s.start.getTime() !== currentStart)
        .map((s) => ({
          id: `dynamic-${s.start.toISOString()}`,
          event_id: event.id,
          start_time: s.start.toISOString(),
          end_time: s.end.toISOString(),
          is_dynamic: true,
        }));
    }
  }

  return NextResponse.json({
    booking: {
      id: booking.id,
      first_name: booking.first_name,
      last_name: booking.last_name,
      email: booking.email,
      cancelled_at: booking.cancelled_at,
      question_responses: booking.question_responses,
    },
    slot: booking.slot,
    event: booking.slot.event,
    availableSlots: openSlots,
  });
}

// PUT reschedule booking
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await safeParseJSON<{ new_slot_id?: string }>(request);
  if (!body) {
    return NextResponse.json({ error: CommonErrors.VALIDATION_ERROR }, { status: 400 });
  }
  let { new_slot_id } = body;

  if (!new_slot_id) {
    return NextResponse.json({ error: 'new_slot_id is required' }, { status: 400 });
  }

  const isDynamicSlot = new_slot_id.startsWith('dynamic-');

  // Validate format: either dynamic-<ISO> or UUID
  if (!isDynamicSlot) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(new_slot_id)) {
      return NextResponse.json({ error: 'Invalid slot ID format' }, { status: 400 });
    }
  }

  const supabase = getServiceSupabase();

  // Get current booking
  const { data: booking, error: bookingError } = await supabase
    .from('oh_bookings')
    .select(`
      *,
      slot:oh_slots!slot_id(
        *,
        event:oh_events!event_id(*)
      ),
      assigned_host:oh_admins!assigned_host_id(id, name, email)
    `)
    .eq('manage_token', token)
    .is('cancelled_at', null)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  const eventData = booking.slot.event;

  // Get host admin for calendar operations
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id, email, name, google_access_token, google_refresh_token')
    .eq('email', eventData.host_email)
    .single();

  // Handle dynamic slots: create the slot on-the-fly (same as booking API)
  if (isDynamicSlot) {
    const startTimeStr = new_slot_id.replace('dynamic-', '');
    const startTime = parseISO(startTimeStr);

    if (isNaN(startTime.getTime())) {
      return NextResponse.json({ error: 'Invalid dynamic slot format' }, { status: 400 });
    }

    if (eventData.meeting_type === 'webinar') {
      return NextResponse.json({ error: 'Webinar events require pre-created time slots' }, { status: 400 });
    }

    const endTime = addMinutes(startTime, eventData.duration_minutes);

    if (!admin) {
      return NextResponse.json({ error: 'No host configured for this event' }, { status: 400 });
    }

    // Verify the time is still available
    const availabilityCheck = await checkTimeAvailability(
      admin.id, startTime, endTime, eventData.id,
      eventData.buffer_before || 0, eventData.buffer_after || 0,
      eventData.ignore_busy_blocks ?? false
    );

    if (!availabilityCheck.available) {
      return NextResponse.json(
        { error: availabilityCheck.reason || 'This time slot is no longer available' },
        { status: 400 }
      );
    }

    // Create Google Calendar event
    let googleEventId: string | null = null;
    let googleMeetLink: string | null = null;

    if (admin.google_access_token && admin.google_refresh_token) {
      try {
        const calendarResult = await createCalendarEvent(
          admin.google_access_token,
          admin.google_refresh_token,
          {
            summary: eventData.name,
            description: eventData.description || '',
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            hostEmail: admin.email,
            attendeeEmail: booking.email,
          }
        );
        googleEventId = calendarResult.eventId || null;
        googleMeetLink = calendarResult.meetLink;
      } catch (err) {
        console.error('Failed to create calendar event for reschedule:', err);
      }
    }

    // Create the slot
    const { data: createdSlot, error: createError } = await supabase
      .from('oh_slots')
      .insert({
        event_id: eventData.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        google_event_id: googleEventId,
        google_meet_link: googleMeetLink,
      })
      .select()
      .single();

    if (createError || !createdSlot) {
      return NextResponse.json({ error: 'Failed to create time slot' }, { status: 500 });
    }

    new_slot_id = createdSlot.id;
  } else {
    // Existing slot: verify it exists and has capacity
    const { data: existingSlot, error: slotError } = await supabase
      .from('oh_slots')
      .select(`
        *,
        event:oh_events!event_id(*),
        bookings:oh_bookings!slot_id(count)
      `)
      .eq('id', new_slot_id)
      .eq('is_cancelled', false)
      .is('bookings.cancelled_at', null)
      .single();

    if (slotError || !existingSlot) {
      return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
    }

    const bookingCount = existingSlot.bookings?.[0]?.count || 0;
    if (bookingCount >= existingSlot.event.max_attendees) {
      return NextResponse.json({ error: CommonErrors.SLOT_FULL }, { status: 400 });
    }

    // Re-check capacity right before update
    const { count: currentCount } = await supabase
      .from('oh_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('slot_id', new_slot_id)
      .is('cancelled_at', null);

    if ((currentCount ?? 0) >= existingSlot.event.max_attendees) {
      return NextResponse.json({ error: CommonErrors.SLOT_FULL }, { status: 400 });
    }
  }

  // Remove attendee from old Google Calendar event
  if (admin?.google_access_token && admin?.google_refresh_token && booking.slot.google_event_id) {
    try {
      await removeAttendeeFromEvent(
        admin.google_access_token,
        admin.google_refresh_token,
        booking.slot.google_event_id,
        booking.email
      );
    } catch (err) {
      console.error('Failed to remove attendee from old calendar event:', err);
    }
  }

  const oldSlotId = booking.slot_id;
  const oldGoogleEventId = booking.slot.google_event_id;
  const oldMeetingType = eventData.meeting_type;

  // Update booking to new slot
  const { error: updateError } = await supabase
    .from('oh_bookings')
    .update({ slot_id: new_slot_id })
    .eq('id', booking.id);

  if (updateError) {
    return NextResponse.json({ error: CommonErrors.SERVER_ERROR }, { status: 500 });
  }

  // Clean up old slot if empty after reschedule (same logic as cancellation)
  if (oldMeetingType !== 'webinar') {
    try {
      const { count: remainingActive } = await supabase
        .from('oh_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('slot_id', oldSlotId)
        .is('cancelled_at', null);

      if (remainingActive === 0) {
        if (oldGoogleEventId && admin?.google_access_token && admin?.google_refresh_token) {
          await deleteCalendarEvent(
            admin.google_access_token,
            admin.google_refresh_token,
            oldGoogleEventId
          );
        }

        await supabase.from('oh_slots').delete().eq('id', oldSlotId);

        calendarLogger.info('Cleaned up empty slot after reschedule', {
          operation: 'rescheduleSlotCleanup',
          slotId: oldSlotId,
          metadata: { calendarDeleted: !!oldGoogleEventId },
        });
      }
    } catch (err) {
      console.error('Failed to clean up old slot after reschedule:', err);
    }
  }

  // Get the new slot for the confirmation email
  const { data: newSlot } = await supabase
    .from('oh_slots')
    .select('*, event:oh_events!event_id(*)')
    .eq('id', new_slot_id)
    .single();

  if (admin?.google_access_token && admin?.google_refresh_token && newSlot) {
    try {
      // Get assigned host for round-robin bookings
      const assignedHost = booking.assigned_host as { id: string; name: string | null; email: string } | null;

      const variables = createEmailVariables(
        booking,
        { ...newSlot.event, meeting_type: newSlot.event.meeting_type },
        newSlot,
        booking.attendee_timezone || newSlot.event.display_timezone || 'America/New_York',
        undefined,
        assignedHost
      );

      const htmlBody = `
        <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
          <h2>Your booking has been rescheduled</h2>
          <p>Hi ${escapeHtml(booking.first_name)},</p>
          <p>Your ${escapeHtml(newSlot.event.name)} session has been rescheduled to:</p>
          <p><strong>${variables.date} at ${variables.time_with_timezone}</strong></p>
          ${newSlot.google_meet_link ? `
            <p>Join via Google Meet: <a href="${newSlot.google_meet_link}">${newSlot.google_meet_link}</a></p>
          ` : ''}
          <p>See you there!<br>${variables.host_name}</p>
        </div>
      `;

      await sendEmail(
        admin.google_access_token,
        admin.google_refresh_token,
        {
          to: booking.email,
          subject: `Rescheduled: ${newSlot.event.name}`,
          replyTo: newSlot.event.host_email,
          htmlBody,
        }
      );
    } catch (err) {
      console.error('Failed to send reschedule confirmation:', err);
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE cancel booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getServiceSupabase();

  // Parse cancellation reason from body
  let cancellationReason: string | null = null;
  try {
    const body = await request.json();
    cancellationReason = body.reason || null;
  } catch {
    // Body might be empty for older clients
  }

  // Get booking
  const { data: booking, error: bookingError } = await supabase
    .from('oh_bookings')
    .select(`
      *,
      slot:oh_slots!slot_id(
        *,
        event:oh_events!event_id(*)
      ),
      assigned_host:oh_admins!assigned_host_id(id, name, email)
    `)
    .eq('manage_token', token)
    .is('cancelled_at', null)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  const wasWaitlisted = booking.is_waitlisted;

  // Cancel the booking with reason
  const { error: updateError } = await supabase
    .from('oh_bookings')
    .update({
      cancelled_at: new Date().toISOString(),
      cancellation_reason: cancellationReason,
    })
    .eq('id', booking.id);

  if (updateError) {
    return NextResponse.json({ error: CommonErrors.SERVER_ERROR }, { status: 500 });
  }

  // Get admin for Google API access
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id, email, google_access_token, google_refresh_token')
    .eq('email', booking.slot.event.host_email)
    .single();

  if (admin?.google_access_token && admin?.google_refresh_token) {
    // Remove attendee from Google Calendar event (only if they were confirmed, not waitlisted)
    if (booking.slot.google_event_id && !wasWaitlisted) {
      try {
        await removeAttendeeFromEvent(
          admin.google_access_token,
          admin.google_refresh_token,
          booking.slot.google_event_id,
          booking.email
        );
        calendarLogger.info('Removed attendee from calendar event', {
          operation: 'cancellation',
          bookingId: booking.id,
          attendeeEmail: booking.email,
          metadata: { googleEventId: booking.slot.google_event_id },
        });
      } catch (err) {
        console.error('Failed to remove attendee from calendar event:', err);
        // Continue with cancellation even if calendar update fails
      }
    }

    // Send cancellation confirmation email
    try {
      // Get assigned host name for round-robin bookings
      const assignedHost = booking.assigned_host as { id: string; name: string | null; email: string } | null;
      const hostName = booking.slot.event.meeting_type === 'round_robin' && assignedHost
        ? (assignedHost.name || assignedHost.email.split('@')[0])
        : booking.slot.event.host_name;

      const bookingLink = `${process.env.NEXT_PUBLIC_APP_URL}/book/${booking.slot.event.slug}`;

      // Format session date/time in event's timezone
      const event = booking.slot.event;
      const eventTimezone = event?.timezone || 'America/Chicago';
      const startTime = parseISO(booking.slot.start_time);
      const zonedTime = toZonedTime(startTime, eventTimezone);
      const sessionDate = format(zonedTime, 'EEEE, MMMM d');
      const sessionTime = format(zonedTime, 'h:mm a');
      const timezoneAbbr = getTimezoneAbbr(eventTimezone);

      // Use styled template for confirmed bookings, simple text for waitlist
      const htmlBody = wasWaitlisted
        ? `
          <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
            <h2>Waitlist Spot Removed</h2>
            <p>Hi ${escapeHtml(booking.first_name)},</p>
            <p>Your waitlist spot for <strong>${escapeHtml(booking.slot.event.name)}</strong> has been removed as requested.</p>
            <p>If you'd like to book another time, we'd love to connect with you:</p>
            <p><a href="${bookingLink}" style="color: #6F71EE; text-decoration: none;">${bookingLink}</a></p>
            <p>Best,<br>${hostName}</p>
          </div>
        `
        : generateCancellationEmailHtml({
            recipientFirstName: booking.first_name,
            eventName: event?.name || 'Session',
            hostName: hostName || 'Your Host',
            sessionDate,
            sessionTime,
            timezoneAbbr,
            bookingPageUrl: bookingLink,
          });

      await sendEmail(
        admin.google_access_token,
        admin.google_refresh_token,
        {
          to: booking.email,
          subject: `Cancelled: ${booking.slot.event.name}`,
          replyTo: booking.slot.event.host_email,
          from: booking.slot.event.host_email,
          htmlBody,
        }
      );
    } catch (err) {
      console.error('Failed to send cancellation confirmation:', err);
    }
  }

  // Sync cancellation to HubSpot
  if (booking.hubspot_contact_id) {
    try {
      const notes = cancellationReason
        ? `Cancelled by attendee. Reason: ${cancellationReason}`
        : 'Cancelled by attendee';
      await updateMeetingOutcome(
        booking.hubspot_contact_id,
        booking.slot.event.name,
        'CANCELED',
        notes
      );
    } catch (err) {
      console.error('Failed to sync cancellation to HubSpot:', err);
    }
  }

  // If the cancelled booking was confirmed (not waitlisted), promote from waitlist
  if (!wasWaitlisted && booking.slot.event.waitlist_enabled) {
    await promoteFromWaitlist(booking.slot_id, booking.slot, admin, supabase);
  }

  // If cancelled booking was waitlisted, update positions for remaining waitlist
  if (wasWaitlisted) {
    await updateWaitlistPositions(booking.slot_id, supabase);
  }

  // Clean up empty slots: if no active bookings remain, delete the slot + calendar event
  // Skip for webinars (pre-created slots that may be needed for future bookings)
  if (booking.slot.event.meeting_type !== 'webinar') {
    try {
      const { count: remainingActive } = await supabase
        .from('oh_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('slot_id', booking.slot_id)
        .is('cancelled_at', null);

      if (remainingActive === 0) {
        if (booking.slot.google_event_id && admin?.google_access_token && admin?.google_refresh_token) {
          await deleteCalendarEvent(
            admin.google_access_token,
            admin.google_refresh_token,
            booking.slot.google_event_id
          );
        }

        await supabase.from('oh_slots').delete().eq('id', booking.slot_id);

        calendarLogger.info('Cleaned up empty slot and calendar event', {
          operation: 'emptySlotCleanup',
          slotId: booking.slot_id,
          metadata: { calendarDeleted: !!booking.slot.google_event_id },
        });
      }
    } catch (err) {
      console.error('Failed to clean up empty slot:', err);
    }
  }

  return NextResponse.json({ success: true });
}

// Helper to promote the first person from the waitlist
async function promoteFromWaitlist(
  slotId: string,
  slot: { google_event_id: string | null; google_meet_link: string | null; start_time: string; end_time: string; event: { id: string; name: string; host_email: string; host_name: string; description: string | null } },
  admin: { google_access_token: string | null; google_refresh_token: string | null } | null,
  supabase: ReturnType<typeof getServiceSupabase>
) {
  // Check that the slot still has capacity before promoting
  const { count: activeCount } = await supabase
    .from('oh_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('slot_id', slotId)
    .is('cancelled_at', null)
    .eq('is_waitlisted', false);

  const { data: slotEvent } = await supabase
    .from('oh_slots')
    .select('event:oh_events!event_id(max_attendees)')
    .eq('id', slotId)
    .single();

  const eventData = slotEvent?.event as unknown as { max_attendees: number } | null;
  const maxAttendees = eventData?.max_attendees ?? 1;
  if ((activeCount ?? 0) >= maxAttendees) {
    return; // Slot is full, don't promote
  }

  // Get the first waitlisted booking
  const { data: nextInLine, error } = await supabase
    .from('oh_bookings')
    .select('id, email, first_name, attendee_timezone, manage_token, is_waitlisted, waitlist_position')
    .eq('slot_id', slotId)
    .is('cancelled_at', null)
    .eq('is_waitlisted', true)
    .order('waitlist_position', { ascending: true })
    .limit(1)
    .single();

  if (error || !nextInLine) {
    // No one on waitlist
    return;
  }

  // Promote them
  const { error: promoteError } = await supabase
    .from('oh_bookings')
    .update({
      is_waitlisted: false,
      waitlist_position: null,
      promoted_from_waitlist_at: new Date().toISOString(),
    })
    .eq('id', nextInLine.id);

  if (promoteError) {
    console.error('Failed to promote from waitlist:', promoteError);
    return;
  }

  // Add to Google Calendar
  if (admin?.google_access_token && admin?.google_refresh_token && slot.google_event_id) {
    const { addAttendeeToEvent } = await import('@/lib/google');
    try {
      await addAttendeeToEvent(
        admin.google_access_token,
        admin.google_refresh_token,
        slot.google_event_id,
        nextInLine.email
      );
    } catch (err) {
      console.error('Failed to add promoted attendee to calendar:', err);
    }
  }

  // Send promotion notification email
  if (admin?.google_access_token && admin?.google_refresh_token) {
    try {
      const { format, parseISO } = await import('date-fns');
      const { formatInTimeZone } = await import('date-fns-tz');
      const timezone = nextInLine.attendee_timezone || 'America/New_York';
      const sessionTime = formatInTimeZone(parseISO(slot.start_time), timezone, "EEEE, MMMM d 'at' h:mm a zzz");
      const manageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/manage/${nextInLine.manage_token}`;

      const htmlBody = `
        <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
          <div style="background: #DCFCE7; border-left: 4px solid #22C55E; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <h2 style="margin: 0 0 8px 0; color: #166534; font-size: 18px;">Great news! You're off the waitlist!</h2>
            <p style="margin: 0; color: #166534; font-size: 14px;">
              A spot opened up and your booking is now confirmed.
            </p>
          </div>

          <p style="color: #667085; font-size: 16px; margin-bottom: 20px;">
            Hi ${escapeHtml(nextInLine.first_name)},
          </p>

          <p style="color: #667085; font-size: 16px; margin-bottom: 20px;">
            A spot has become available for <strong>${escapeHtml(slot.event.name)}</strong> and you've been moved from the waitlist to a confirmed booking!
          </p>

          <p style="color: #667085; font-size: 16px; margin-bottom: 20px;">
            <strong>When:</strong> ${sessionTime}
          </p>

          ${slot.google_meet_link ? `
            <div style="background: #6F71EE; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <a href="${slot.google_meet_link}" style="color: white; text-decoration: none; font-weight: 600;">
                Join Google Meet →
              </a>
            </div>
          ` : ''}

          <p style="color: #667085; font-size: 14px; margin-bottom: 20px;">
            A calendar invite has been sent to your email. Please add this session to your calendar.
          </p>

          <div style="background: #F6F6F9; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="color: #667085; margin: 0 0 12px 0; font-size: 14px;">
              Can't make it anymore? Let us know so someone else can take your spot.
            </p>
            <a href="${manageUrl}" style="display: inline-block; background: #6F71EE; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Manage Booking
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
          to: nextInLine.email,
          subject: `You're confirmed! ${slot.event.name}`,
          replyTo: slot.event.host_email,
          htmlBody,
        }
      );

      // Mark notification sent
      await supabase
        .from('oh_bookings')
        .update({ waitlist_notification_sent_at: new Date().toISOString() })
        .eq('id', nextInLine.id);
    } catch (err) {
      console.error('Failed to send waitlist promotion email:', err);
    }
  }

  // Update positions for remaining waitlisted bookings
  await updateWaitlistPositions(slotId, supabase);
}

// Helper to update waitlist positions after a promotion or cancellation
async function updateWaitlistPositions(
  slotId: string,
  supabase: ReturnType<typeof getServiceSupabase>
) {
  // Get all remaining waitlisted bookings ordered by current position
  const { data: waitlisted } = await supabase
    .from('oh_bookings')
    .select('id, waitlist_position')
    .eq('slot_id', slotId)
    .is('cancelled_at', null)
    .eq('is_waitlisted', true)
    .order('waitlist_position', { ascending: true });

  if (!waitlisted || waitlisted.length === 0) return;

  // Update each position sequentially
  for (let i = 0; i < waitlisted.length; i++) {
    const newPosition = i + 1;
    if (waitlisted[i].waitlist_position !== newPosition) {
      await supabase
        .from('oh_bookings')
        .update({ waitlist_position: newPosition })
        .eq('id', waitlisted[i].id);
    }
  }
}
