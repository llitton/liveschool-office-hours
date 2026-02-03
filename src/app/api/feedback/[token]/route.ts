import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { safeParseJSON } from '@/lib/errors';

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
      slot:oh_slots!slot_id(
        start_time,
        event:oh_events!event_id(name, host_name)
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
  const body = await safeParseJSON(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { rating, comment, topics_for_next_time } = body;

  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return NextResponse.json(
      { error: 'Rating must be an integer between 1 and 5' },
      { status: 400 }
    );
  }

  if (comment && typeof comment === 'string' && comment.length > 5000) {
    return NextResponse.json(
      { error: 'Comment must be 5,000 characters or less' },
      { status: 400 }
    );
  }

  if (topics_for_next_time && typeof topics_for_next_time === 'string' && topics_for_next_time.length > 5000) {
    return NextResponse.json(
      { error: 'Topic suggestion must be 5,000 characters or less' },
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

  // Update booking with feedback
  const { error: updateError } = await supabase
    .from('oh_bookings')
    .update({
      feedback_rating: numRating,
      feedback_comment: comment || null,
      feedback_topic_suggestion: topics_for_next_time || null,
      feedback_submitted_at: new Date().toISOString(),
    })
    .eq('id', booking.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
