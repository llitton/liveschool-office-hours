import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { addWeeks } from 'date-fns';
import crypto from 'crypto';

function generateManageToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// POST create a series booking
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    slot_id,
    first_name,
    last_name,
    email,
    question_responses,
    recurrence_pattern = 'weekly',
    total_sessions = 4,
  } = body;

  if (!slot_id || !first_name || !last_name || !email) {
    return NextResponse.json(
      { error: 'slot_id, first_name, last_name, and email are required' },
      { status: 400 }
    );
  }

  if (total_sessions < 2 || total_sessions > 12) {
    return NextResponse.json(
      { error: 'total_sessions must be between 2 and 12' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get the initial slot with event details
  const { data: initialSlot, error: slotError } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*)
    `)
    .eq('id', slot_id)
    .single();

  if (slotError || !initialSlot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }

  const eventId = initialSlot.event_id;

  // Calculate interval based on recurrence pattern
  const weeksInterval = recurrence_pattern === 'biweekly' ? 2 : recurrence_pattern === 'monthly' ? 4 : 1;

  // Find all slots for the series
  const slotStartTime = new Date(initialSlot.start_time);
  const slotEndTime = new Date(initialSlot.end_time);
  const dayOfWeek = slotStartTime.getDay();
  const timeOfDay = slotStartTime.toTimeString().substring(0, 5);

  // Create the series record
  const { data: series, error: seriesError } = await supabase
    .from('oh_booking_series')
    .insert({
      attendee_email: email.toLowerCase(),
      event_id: eventId,
      recurrence_pattern,
      total_sessions,
    })
    .select()
    .single();

  if (seriesError) {
    return NextResponse.json({ error: seriesError.message }, { status: 500 });
  }

  // Find or create slots for each session in the series
  const bookings = [];
  let currentDate = new Date(slotStartTime);

  for (let i = 0; i < total_sessions; i++) {
    // For first session, use the provided slot
    if (i === 0) {
      // Check availability
      const { data: existingBooking } = await supabase
        .from('oh_bookings')
        .select('id')
        .eq('slot_id', slot_id)
        .eq('email', email.toLowerCase())
        .is('cancelled_at', null)
        .single();

      if (existingBooking) {
        // Clean up series and return error
        await supabase.from('oh_booking_series').delete().eq('id', series.id);
        return NextResponse.json(
          { error: 'You have already booked the initial time slot' },
          { status: 400 }
        );
      }

      // Create booking for initial slot
      const manage_token = generateManageToken();
      const { data: booking, error: bookingError } = await supabase
        .from('oh_bookings')
        .insert({
          slot_id,
          first_name,
          last_name,
          email: email.toLowerCase(),
          manage_token,
          question_responses: question_responses || {},
          series_id: series.id,
          series_sequence: 1,
        })
        .select()
        .single();

      if (bookingError) {
        await supabase.from('oh_booking_series').delete().eq('id', series.id);
        return NextResponse.json({ error: bookingError.message }, { status: 500 });
      }

      bookings.push({ ...booking, slot: initialSlot });
    } else {
      // Find a slot for subsequent sessions
      currentDate = addWeeks(currentDate, weeksInterval);

      // Look for an existing slot at the same day/time
      const searchStart = new Date(currentDate);
      searchStart.setHours(0, 0, 0, 0);
      const searchEnd = new Date(currentDate);
      searchEnd.setHours(23, 59, 59, 999);

      const { data: matchingSlots } = await supabase
        .from('oh_slots')
        .select('*, bookings:oh_bookings(count)')
        .eq('event_id', eventId)
        .eq('is_cancelled', false)
        .gte('start_time', searchStart.toISOString())
        .lte('start_time', searchEnd.toISOString());

      // Find a slot at the same time
      let targetSlot = matchingSlots?.find((s) => {
        const slotTime = new Date(s.start_time).toTimeString().substring(0, 5);
        return slotTime === timeOfDay;
      });

      if (!targetSlot) {
        // No slot available at this time - skip this session
        console.log(`No slot available for series session ${i + 1} on ${currentDate.toDateString()}`);
        continue;
      }

      // Check if slot has capacity
      const bookingCount = targetSlot.bookings?.[0]?.count || 0;
      if (bookingCount >= initialSlot.event.max_attendees) {
        console.log(`Slot full for series session ${i + 1}`);
        continue;
      }

      // Create booking for this slot
      const manage_token = generateManageToken();
      const { data: booking, error: bookingError } = await supabase
        .from('oh_bookings')
        .insert({
          slot_id: targetSlot.id,
          first_name,
          last_name,
          email: email.toLowerCase(),
          manage_token,
          question_responses: question_responses || {},
          series_id: series.id,
          series_sequence: i + 1,
        })
        .select()
        .single();

      if (!bookingError) {
        bookings.push({ ...booking, slot: targetSlot });
      }
    }
  }

  // Update series with actual session count
  await supabase
    .from('oh_booking_series')
    .update({ total_sessions: bookings.length })
    .eq('id', series.id);

  return NextResponse.json({
    series: { ...series, total_sessions: bookings.length },
    bookings,
    event: initialSlot.event,
  });
}

// GET series by email (for attendee to view their series)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const seriesId = searchParams.get('seriesId');

  const supabase = getServiceSupabase();

  if (seriesId) {
    // Get specific series
    const { data: series, error } = await supabase
      .from('oh_booking_series')
      .select(`
        *,
        event:oh_events(name, slug),
        bookings:oh_bookings(
          *,
          slot:oh_slots(start_time, end_time, google_meet_link)
        )
      `)
      .eq('id', seriesId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(series);
  }

  if (!email) {
    return NextResponse.json({ error: 'email or seriesId is required' }, { status: 400 });
  }

  // Get all series for this email
  const { data: series, error } = await supabase
    .from('oh_booking_series')
    .select(`
      *,
      event:oh_events(name, slug),
      bookings:oh_bookings(
        *,
        slot:oh_slots(start_time, end_time)
      )
    `)
    .eq('attendee_email', email.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(series);
}
