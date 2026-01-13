import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// GET feedback form data (public, uses manage token)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getServiceSupabase();

  const { data: booking, error } = await supabase
    .from('oh_bookings')
    .select(`
      id,
      first_name,
      feedback_rating,
      feedback_comment,
      feedback_submitted_at,
      slot:oh_slots(
        start_time,
        event:oh_events(name, host_name)
      )
    `)
    .eq('manage_token', token)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Handle Supabase nested relation types
  const slotData = booking.slot as { start_time?: string; event?: { name?: string; host_name?: string }[] } | null;
  const eventArray = slotData?.event;
  const eventData = Array.isArray(eventArray) ? eventArray[0] : eventArray;

  return NextResponse.json({
    first_name: booking.first_name,
    event_name: eventData?.name,
    host_name: eventData?.host_name,
    session_date: slotData?.start_time,
    already_submitted: !!booking.feedback_submitted_at,
    existing_rating: booking.feedback_rating,
    existing_comment: booking.feedback_comment,
  });
}

// POST submit feedback (public, uses manage token)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { rating, comment, topics_for_next_time } = body;

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: 'Rating must be between 1 and 5' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get booking by manage token
  const { data: booking, error: bookingError } = await supabase
    .from('oh_bookings')
    .select('id')
    .eq('manage_token', token)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Build comment with topics suggestion if provided
  let fullComment = comment || '';
  if (topics_for_next_time) {
    fullComment += fullComment ? '\n\n' : '';
    fullComment += `Topics for next time: ${topics_for_next_time}`;
  }

  // Update booking with feedback
  const { error: updateError } = await supabase
    .from('oh_bookings')
    .update({
      feedback_rating: rating,
      feedback_comment: fullComment || null,
      feedback_submitted_at: new Date().toISOString(),
    })
    .eq('id', booking.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
