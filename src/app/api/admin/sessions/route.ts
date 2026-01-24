import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface SessionData {
  id: string;
  start_time: string;
  end_time: string;
  google_meet_link: string | null;
  event: {
    id: string;
    name: string;
    slug: string;
    max_attendees: number;
  };
  attendeeCount: number;
  attendedCount: number;
  noShowCount: number;
  // Feedback summary
  feedbackCount: number;
  averageRating: number | null;
}

// GET sessions by period: upcoming, past
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get('period') || 'upcoming';
  const limit = parseInt(searchParams.get('limit') || '50');

  const supabase = getServiceSupabase();
  const now = new Date();
  const timezone = 'America/New_York';
  const zonedNow = toZonedTime(now, timezone);
  const todayStart = startOfDay(zonedNow);
  const todayEnd = endOfDay(zonedNow);

  let query = supabase
    .from('oh_slots')
    .select(`
      id,
      start_time,
      end_time,
      google_meet_link,
      event:oh_events(id, name, slug, max_attendees),
      bookings:oh_bookings(
        id,
        cancelled_at,
        attended_at,
        no_show_at,
        feedback_rating
      )
    `)
    .eq('is_cancelled', false);

  if (period === 'upcoming') {
    // Future sessions (after today)
    query = query
      .gt('start_time', todayEnd.toISOString())
      .order('start_time', { ascending: true })
      .limit(limit);
  } else if (period === 'past') {
    // Past sessions (before today)
    query = query
      .lt('start_time', todayStart.toISOString())
      .order('start_time', { ascending: false })
      .limit(limit);
  } else {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
  }

  const { data: slots, error: slotsError } = await query;

  if (slotsError) {
    console.error('Error fetching sessions:', slotsError);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }

  const sessions: SessionData[] = (slots || []).map((slot) => {
    const eventData = slot.event as unknown as { id: string; name: string; slug: string; max_attendees: number };
    const bookings = (slot.bookings as Array<{
      id: string;
      cancelled_at: string | null;
      attended_at: string | null;
      no_show_at: string | null;
      feedback_rating: number | null;
    }>) || [];

    // Filter out cancelled bookings
    const activeBookings = bookings.filter(b => !b.cancelled_at);
    const attendedCount = activeBookings.filter(b => b.attended_at).length;
    const noShowCount = activeBookings.filter(b => b.no_show_at).length;

    // Calculate feedback stats
    const bookingsWithFeedback = activeBookings.filter(b => b.feedback_rating !== null);
    const feedbackCount = bookingsWithFeedback.length;
    const averageRating = feedbackCount > 0
      ? bookingsWithFeedback.reduce((sum, b) => sum + (b.feedback_rating || 0), 0) / feedbackCount
      : null;

    return {
      id: slot.id,
      start_time: slot.start_time,
      end_time: slot.end_time,
      google_meet_link: slot.google_meet_link,
      event: eventData,
      attendeeCount: activeBookings.length,
      attendedCount,
      noShowCount,
      feedbackCount,
      averageRating,
    };
  });

  return NextResponse.json({ sessions });
}
