import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

interface FeedbackItem {
  id: string;
  attendee_name: string;
  attendee_email: string;
  rating: number;
  comment: string | null;
  topic_suggestion: string | null;
  submitted_at: string;
}

// GET feedback details for a specific session (slot)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: slotId } = await params;
  const supabase = getServiceSupabase();

  // Get slot info and bookings with feedback
  const { data: slot, error: slotError } = await supabase
    .from('oh_slots')
    .select(`
      id,
      start_time,
      end_time,
      event:oh_events(id, name)
    `)
    .eq('id', slotId)
    .single();

  if (slotError || !slot) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Get bookings with feedback
  const { data: bookings, error: bookingsError } = await supabase
    .from('oh_bookings')
    .select(`
      id,
      first_name,
      last_name,
      email,
      feedback_rating,
      feedback_comment,
      feedback_topic_suggestion,
      feedback_submitted_at
    `)
    .eq('slot_id', slotId)
    .is('cancelled_at', null)
    .not('feedback_rating', 'is', null)
    .order('feedback_submitted_at', { ascending: false });

  if (bookingsError) {
    console.error('Error fetching feedback:', bookingsError);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }

  const feedback: FeedbackItem[] = (bookings || []).map(b => ({
    id: b.id,
    attendee_name: `${b.first_name} ${b.last_name}`.trim(),
    attendee_email: b.email,
    rating: b.feedback_rating!,
    comment: b.feedback_comment,
    topic_suggestion: b.feedback_topic_suggestion,
    submitted_at: b.feedback_submitted_at!,
  }));

  const eventData = slot.event as unknown as { id: string; name: string };

  return NextResponse.json({
    session: {
      id: slot.id,
      start_time: slot.start_time,
      end_time: slot.end_time,
      event_name: eventData?.name || 'Unknown Event',
    },
    feedback,
    averageRating: feedback.length > 0
      ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length
      : null,
  });
}
