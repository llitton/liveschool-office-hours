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

  // Get admin ID for the current session to scope results
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  // Get event IDs this admin hosts (as primary host or co-host)
  let hostedEventIds: string[] = [];
  if (admin) {
    const { data: hostedEvents } = await supabase
      .from('oh_events')
      .select('id')
      .eq('host_email', session.email);

    const { data: cohostedEvents } = await supabase
      .from('oh_event_hosts')
      .select('event_id')
      .eq('admin_id', admin.id);

    const primaryIds = hostedEvents?.map(e => e.id) || [];
    const coHostIds = cohostedEvents?.map(e => e.event_id) || [];
    hostedEventIds = [...new Set([...primaryIds, ...coHostIds])];
  }

  // Get bookings for this attendee, scoped to the admin's events
  const { data: bookings, error: bookingsError } = await supabase
    .from('oh_bookings')
    .select(`
      *,
      slot:oh_slots!slot_id(
        *,
        event:oh_events!event_id(name, host_name)
      )
    `)
    .eq('email', decodedEmail)
    .order('created_at', { ascending: false });

  if (bookingsError) {
    return NextResponse.json({ error: bookingsError.message }, { status: 500 });
  }

  // Filter bookings to only those from events the admin hosts
  const scopedBookings = hostedEventIds.length > 0
    ? (bookings || []).filter((b: { slot?: { event_id?: string } }) =>
        b.slot?.event_id && hostedEventIds.includes(b.slot.event_id)
      )
    : bookings || [];

  // Get notes for this attendee
  const { data: notes } = await supabase
    .from('oh_attendee_notes')
    .select('*')
    .eq('attendee_email', decodedEmail)
    .order('created_at', { ascending: false });

  // Calculate stats from scoped bookings
  const totalBookings = scopedBookings.length;
  const attended = scopedBookings.filter(b => b.attended_at).length;
  const noShows = scopedBookings.filter(b => b.no_show_at).length;
  const cancelled = scopedBookings.filter(b => b.cancelled_at).length;
  const upcoming = scopedBookings.filter(b =>
    !b.cancelled_at &&
    new Date(b.slot?.start_time) > new Date()
  ).length;

  // Get first booking date
  const firstBooking = scopedBookings.length
    ? scopedBookings[scopedBookings.length - 1].created_at
    : null;

  // Get average feedback rating
  const ratingsWithFeedback = scopedBookings.filter(b => b.feedback_rating !== null);
  const avgRating = ratingsWithFeedback.length > 0
    ? ratingsWithFeedback.reduce((sum, b) => sum + (b.feedback_rating || 0), 0) / ratingsWithFeedback.length
    : null;

  // Get most common topics from question responses
  const topics: Record<string, number> = {};
  for (const booking of scopedBookings) {
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
    bookings: scopedBookings,
    notes: notes || [],
    isRepeatAttendee: totalBookings > 1,
    isFrequentAttendee: attended >= 3,
  });
}
