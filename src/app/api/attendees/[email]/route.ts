import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// GET attendee stats and history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email } = await params;
  const decodedEmail = decodeURIComponent(email).toLowerCase();
  const supabase = getServiceSupabase();

  // Get all bookings for this attendee
  const { data: bookings, error: bookingsError } = await supabase
    .from('oh_bookings')
    .select(`
      *,
      slot:oh_slots(
        *,
        event:oh_events(name, host_name)
      )
    `)
    .eq('email', decodedEmail)
    .order('created_at', { ascending: false });

  if (bookingsError) {
    return NextResponse.json({ error: bookingsError.message }, { status: 500 });
  }

  // Get notes for this attendee
  const { data: notes } = await supabase
    .from('oh_attendee_notes')
    .select('*')
    .eq('attendee_email', decodedEmail)
    .order('created_at', { ascending: false });

  // Calculate stats
  const totalBookings = bookings?.length || 0;
  const attended = bookings?.filter(b => b.attended_at).length || 0;
  const noShows = bookings?.filter(b => b.no_show_at).length || 0;
  const cancelled = bookings?.filter(b => b.cancelled_at).length || 0;
  const upcoming = bookings?.filter(b =>
    !b.cancelled_at &&
    new Date(b.slot?.start_time) > new Date()
  ).length || 0;

  // Get first booking date
  const firstBooking = bookings?.length
    ? bookings[bookings.length - 1].created_at
    : null;

  // Get average feedback rating
  const ratingsWithFeedback = bookings?.filter(b => b.feedback_rating !== null) || [];
  const avgRating = ratingsWithFeedback.length > 0
    ? ratingsWithFeedback.reduce((sum, b) => sum + (b.feedback_rating || 0), 0) / ratingsWithFeedback.length
    : null;

  // Get most common topics from question responses
  const topics: Record<string, number> = {};
  for (const booking of bookings || []) {
    if (booking.question_responses) {
      for (const response of Object.values(booking.question_responses)) {
        if (typeof response === 'string' && response.trim()) {
          // Simple word extraction for topic analysis
          const words = response.toLowerCase().split(/\s+/);
          for (const word of words) {
            if (word.length > 4) { // Only count meaningful words
              topics[word] = (topics[word] || 0) + 1;
            }
          }
        }
      }
    }
  }

  return NextResponse.json({
    email: decodedEmail,
    stats: {
      totalBookings,
      attended,
      noShows,
      cancelled,
      upcoming,
      noShowRate: totalBookings > 0 ? Math.round((noShows / totalBookings) * 100) : 0,
      attendanceRate: (attended + noShows) > 0 ? Math.round((attended / (attended + noShows)) * 100) : null,
      avgRating,
      firstBooking,
    },
    bookings: bookings || [],
    notes: notes || [],
    isRepeatAttendee: totalBookings > 1,
    isFrequentAttendee: attended >= 3,
  });
}
