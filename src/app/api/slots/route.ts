import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { createCalendarEvent } from '@/lib/google';

// GET slots for an event
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const eventId = searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Get slots with booking counts
  const { data: slots, error } = await supabase
    .from('oh_slots')
    .select(`
      *,
      bookings:oh_bookings(count)
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
  const { event_id, start_time, end_time } = body;

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

  // Create Google Calendar event if admin has tokens
  let googleEventId: string | null = null;
  let googleMeetLink: string | null = null;

  if (session.google_access_token && session.google_refresh_token) {
    try {
      const calendarResult = await createCalendarEvent(
        session.google_access_token,
        session.google_refresh_token,
        {
          summary: `[Office Hours] ${event.name}`,
          description: event.description || '',
          startTime: start_time,
          endTime: end_time,
          hostEmail: event.host_email,
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
