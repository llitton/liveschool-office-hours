import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession, getHostWithTokens } from '@/lib/auth';
import { createCalendarEvent, getFreeBusy } from '@/lib/google';
import { checkTimeAvailability } from '@/lib/availability';
import { parseISO, startOfDay, endOfDay, areIntervalsOverlapping } from 'date-fns';

// GET slots for an event
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const eventId = searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

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
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform to include booking count
  const slotsWithCounts = slots.map((slot) => ({
    ...slot,
    booking_count: slot.bookings?.[0]?.count || 0,
  }));

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
  if (event.buffer_minutes > 0) {
    const slotStart = new Date(start_time);
    const slotEnd = new Date(end_time);
    const bufferMs = event.buffer_minutes * 60 * 1000;

    // Calculate buffer window
    const bufferStart = new Date(slotStart.getTime() - bufferMs);
    const bufferEnd = new Date(slotEnd.getTime() + bufferMs);

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
        (slotStart < new Date(existingEnd.getTime() + bufferMs) && slotEnd > existingStart) || // New slot starts during buffer after existing
        (slotEnd > new Date(existingStart.getTime() - bufferMs) && slotStart < existingEnd) // New slot ends during buffer before existing
      ) {
        return NextResponse.json(
          { error: `This slot conflicts with existing slots. Buffer time: ${event.buffer_minutes} minutes.` },
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
          event.buffer_minutes || 0
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
        event.buffer_minutes || 0
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

  if (calendarAccessToken && calendarRefreshToken) {
    try {
      const calendarResult = await createCalendarEvent(
        calendarAccessToken,
        calendarRefreshToken,
        {
          summary: `[Office Hours] ${event.name}`,
          description: event.description || '',
          startTime: start_time,
          endTime: end_time,
          hostEmail: hostEmail,
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
