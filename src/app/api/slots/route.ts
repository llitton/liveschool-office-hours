import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession, getHostWithTokens } from '@/lib/auth';
import { createCalendarEvent, getFreeBusy } from '@/lib/google';
import { checkTimeAvailability, checkCollectiveAvailability } from '@/lib/availability';
import { getParticipatingHosts } from '@/lib/round-robin';
import { parseISO, startOfDay, endOfDay, areIntervalsOverlapping, addHours, addDays, isBefore, isAfter } from 'date-fns';

// GET slots for an event
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const eventId = searchParams.get('eventId');
  const includeAll = searchParams.get('includeAll') === 'true'; // Admin can see all slots

  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // First get the event to check constraints
  const { data: event, error: eventError } = await supabase
    .from('oh_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Calculate constraint boundaries
  const now = new Date();
  const minNoticeHours = event.min_notice_hours ?? 24;
  const bookingWindowDays = event.booking_window_days ?? 60;

  // Earliest bookable time (respecting minimum notice)
  const earliestBookable = addHours(now, minNoticeHours);
  // Latest bookable time (respecting booking window)
  const latestBookable = addDays(now, bookingWindowDays);

  // Get slots with booking counts and assigned host info
  const { data: slots, error } = await supabase
    .from('oh_slots')
    .select(`
      *,
      bookings:oh_bookings(count),
      assigned_host:oh_admins!assigned_host_id(id, name, email)
    `)
    .eq('event_id', eventId)
    .eq('is_cancelled', false)
    .gte('start_time', now.toISOString())
    .order('start_time', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform to include booking count and filter by constraints (unless admin)
  const slotsWithCounts = slots
    .map((slot) => ({
      ...slot,
      booking_count: slot.bookings?.[0]?.count || 0,
    }))
    .filter((slot) => {
      // Admin can see all slots
      if (includeAll) return true;

      const slotStart = parseISO(slot.start_time);

      // Filter out slots that don't meet minimum notice
      if (isBefore(slotStart, earliestBookable)) {
        return false;
      }

      // Filter out slots outside booking window
      if (isAfter(slotStart, latestBookable)) {
        return false;
      }

      return true;
    });

  return NextResponse.json(slotsWithCounts);
}

// POST create new slot (admin only)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { event_id, start_time, end_time, assigned_host_id } = body;

  if (!event_id || !start_time || !end_time) {
    return NextResponse.json(
      { error: 'event_id, start_time, and end_time are required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get the event details
  const { data: event, error: eventError } = await supabase
    .from('oh_events')
    .select('*')
    .eq('id', event_id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Check for buffer time conflicts with existing slots
  const bufferBefore = event.buffer_before || 0;
  const bufferAfter = event.buffer_after || 0;

  if (bufferBefore > 0 || bufferAfter > 0) {
    const slotStart = new Date(start_time);
    const slotEnd = new Date(end_time);
    const bufferBeforeMs = bufferBefore * 60 * 1000;
    const bufferAfterMs = bufferAfter * 60 * 1000;

    // Check for overlapping slots
    const { data: existingSlots } = await supabase
      .from('oh_slots')
      .select('id, start_time, end_time')
      .eq('event_id', event_id)
      .eq('is_cancelled', false);

    for (const existing of existingSlots || []) {
      const existingStart = new Date(existing.start_time);
      const existingEnd = new Date(existing.end_time);

      // Check if new slot overlaps with existing slot (including buffer)
      if (
        (slotStart < existingEnd && slotEnd > existingStart) || // Direct overlap
        (slotStart < new Date(existingEnd.getTime() + bufferAfterMs) && slotEnd > existingStart) || // New slot starts during buffer after existing
        (slotEnd > new Date(existingStart.getTime() - bufferBeforeMs) && slotStart < existingEnd) // New slot ends during buffer before existing
      ) {
        return NextResponse.json(
          { error: `This slot conflicts with existing slots. Buffer: ${bufferBefore}m before, ${bufferAfter}m after.` },
          { status: 400 }
        );
      }
    }
  }

  // For collective events AND webinars with co-hosts, check that ALL hosts are available
  // Get participating hosts (co-hosts) for the event
  const participatingHosts = await getParticipatingHosts(event_id);
  const hasCoHosts = participatingHosts.length > 0;

  if (event.meeting_type === 'collective' || (event.meeting_type === 'webinar' && hasCoHosts)) {
    if (hasCoHosts) {
      const collectiveCheck = await checkCollectiveAvailability(
        participatingHosts,
        parseISO(start_time),
        parseISO(end_time),
        event_id
      );

      if (!collectiveCheck.available) {
        // Get names of unavailable hosts
        const { data: admins } = await supabase
          .from('oh_admins')
          .select('id, name, email')
          .in('id', collectiveCheck.unavailableHosts);

        const hostNames = admins?.map(a => a.name || a.email).join(', ') || 'Some hosts';
        return NextResponse.json(
          { error: `Not all hosts are available. Unavailable: ${hostNames}` },
          { status: 400 }
        );
      }
    }
  }

  // Determine which host to use for availability check and calendar
  // Priority: assigned_host_id > event.host_id > current session
  let hostAdmin = null;
  let hostId = assigned_host_id || event.host_id;

  if (hostId) {
    // Use the assigned or event host
    hostAdmin = await getHostWithTokens(hostId);
  }

  // Fall back to current session if no host specified
  if (!hostAdmin) {
    const { data: sessionAdmin } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', session.email)
      .single();
    hostAdmin = sessionAdmin;
    hostId = sessionAdmin?.id;
  }

  // Skip individual availability check for collective (already done above)
  // Check availability against the host's calendar using LIVE Google Calendar data
  if (hostAdmin?.google_access_token && hostAdmin?.google_refresh_token) {
    try {
      const slotStart = parseISO(start_time);
      const slotEnd = parseISO(end_time);
      const dayStart = startOfDay(slotStart);
      const dayEnd = endOfDay(slotStart);

      // Fetch live busy times from Google Calendar
      const busyTimes = await getFreeBusy(
        hostAdmin.google_access_token,
        hostAdmin.google_refresh_token,
        dayStart.toISOString(),
        dayEnd.toISOString()
      );

      // Check for conflicts with live calendar data
      for (const busy of busyTimes) {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);

        if (
          areIntervalsOverlapping(
            { start: slotStart, end: slotEnd },
            { start: busyStart, end: busyEnd }
          )
        ) {
          return NextResponse.json(
            { error: 'Conflicts with calendar event' },
            { status: 400 }
          );
        }
      }
    } catch (err) {
      // Log but don't block - live calendar check is optional
      console.warn('Live calendar check failed, falling back to cached data:', err);

      // Fall back to cached availability check
      try {
        const availabilityCheck = await checkTimeAvailability(
          hostAdmin.id,
          parseISO(start_time),
          parseISO(end_time),
          event_id,
          bufferBefore,
          bufferAfter
        );

        if (!availabilityCheck.available) {
          return NextResponse.json(
            { error: availabilityCheck.reason || 'Time slot is not available' },
            { status: 400 }
          );
        }
      } catch (innerErr) {
        console.warn('Cached availability check also failed:', innerErr);
      }
    }
  } else if (hostAdmin) {
    // No Google tokens - use cached availability check
    try {
      const availabilityCheck = await checkTimeAvailability(
        hostAdmin.id,
        parseISO(start_time),
        parseISO(end_time),
        event_id,
        bufferBefore,
        bufferAfter
      );

      if (!availabilityCheck.available) {
        return NextResponse.json(
          { error: availabilityCheck.reason || 'Time slot is not available' },
          { status: 400 }
        );
      }
    } catch (err) {
      console.warn('Availability check failed, proceeding anyway:', err);
    }
  }

  // Create Google Calendar event using host's tokens
  let googleEventId: string | null = null;
  let googleMeetLink: string | null = null;

  // Use host's tokens if available, otherwise fall back to session
  const calendarAccessToken = hostAdmin?.google_access_token || session.google_access_token;
  const calendarRefreshToken = hostAdmin?.google_refresh_token || session.google_refresh_token;
  const hostEmail = hostAdmin?.email || event.host_email;

  // For collective events and webinars with co-hosts, get all co-host emails
  let coHostEmails: string[] = [];
  if ((event.meeting_type === 'collective' || event.meeting_type === 'webinar') && hasCoHosts) {
    const { data: coHosts } = await supabase
      .from('oh_admins')
      .select('email')
      .in('id', participatingHosts);
    coHostEmails = coHosts?.map(h => h.email) || [];
  }

  if (calendarAccessToken && calendarRefreshToken) {
    try {
      const calendarResult = await createCalendarEvent(
        calendarAccessToken,
        calendarRefreshToken,
        {
          summary: `[Connect] ${event.name}`,
          description: event.description || '',
          startTime: start_time,
          endTime: end_time,
          hostEmail: hostEmail,
          coHostEmails: coHostEmails.length > 0 ? coHostEmails : undefined,
        }
      );
      googleEventId = calendarResult.eventId || null;
      googleMeetLink = calendarResult.meetLink;
    } catch (err) {
      console.error('Failed to create calendar event:', err);
      // Continue without calendar integration
    }
  }

  // Create the slot
  const { data: slot, error } = await supabase
    .from('oh_slots')
    .insert({
      event_id,
      start_time,
      end_time,
      assigned_host_id: assigned_host_id || null,
      google_event_id: googleEventId,
      google_meet_link: googleMeetLink,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(slot);
}
