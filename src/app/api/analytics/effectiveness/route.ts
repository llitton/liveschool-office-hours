import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { subDays, startOfWeek, format, startOfMonth } from 'date-fns';

// GET session effectiveness metrics
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const period = searchParams.get('period') || 'week'; // week, month, all

  const supabase = getServiceSupabase();

  let startDate: Date;
  if (period === 'month') {
    startDate = startOfMonth(subDays(new Date(), 90)); // Last 3 months
  } else if (period === 'all') {
    startDate = new Date('2020-01-01'); // All time
  } else {
    startDate = startOfWeek(subDays(new Date(), 56)); // Last 8 weeks
  }

  // Get slots with bookings and feedback
  let query = supabase
    .from('oh_slots')
    .select(`
      id,
      start_time,
      end_time,
      event:oh_events!inner(id, name),
      bookings:oh_bookings(
        id,
        status,
        created_at,
        feedback_rating,
        question_responses
      )
    `)
    .gte('start_time', startDate.toISOString())
    .lte('start_time', new Date().toISOString())
    .eq('is_cancelled', false);

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data: slots, error } = await query.order('start_time', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get session tags for resolved status
  const bookingIds = slots?.flatMap((s) => s.bookings?.map((b) => b.id) || []) || [];

  let tagData: Record<string, string[]> = {};
  if (bookingIds.length > 0) {
    const { data: bookingTags } = await supabase
      .from('oh_booking_tags')
      .select(`
        booking_id,
        tag:oh_session_tags(name)
      `)
      .in('booking_id', bookingIds);

    if (bookingTags) {
      bookingTags.forEach((bt) => {
        if (!tagData[bt.booking_id]) {
          tagData[bt.booking_id] = [];
        }
        if (bt.tag && typeof bt.tag === 'object' && 'name' in bt.tag) {
          tagData[bt.booking_id].push((bt.tag as unknown as { name: string }).name);
        }
      });
    }
  }

  // Calculate metrics per period
  const periodMetrics: Record<string, {
    period: string;
    sessions: number;
    totalBookings: number;
    attended: number;
    noShows: number;
    resolved: number;
    avgRating: number | null;
    ratingCount: number;
  }> = {};

  slots?.forEach((slot) => {
    const periodKey = period === 'month'
      ? format(new Date(slot.start_time), 'yyyy-MM')
      : format(startOfWeek(new Date(slot.start_time)), 'yyyy-MM-dd');

    if (!periodMetrics[periodKey]) {
      periodMetrics[periodKey] = {
        period: periodKey,
        sessions: 0,
        totalBookings: 0,
        attended: 0,
        noShows: 0,
        resolved: 0,
        avgRating: null,
        ratingCount: 0,
      };
    }

    periodMetrics[periodKey].sessions++;

    slot.bookings?.forEach((booking) => {
      periodMetrics[periodKey].totalBookings++;

      if (booking.status === 'attended') {
        periodMetrics[periodKey].attended++;
      } else if (booking.status === 'no_show') {
        periodMetrics[periodKey].noShows++;
      }

      // Check if resolved
      const tags = tagData[booking.id] || [];
      if (tags.includes('Resolved')) {
        periodMetrics[periodKey].resolved++;
      }

      // Track ratings
      if (booking.feedback_rating !== null && booking.feedback_rating !== undefined) {
        const currentTotal = (periodMetrics[periodKey].avgRating || 0) * periodMetrics[periodKey].ratingCount;
        periodMetrics[periodKey].ratingCount++;
        periodMetrics[periodKey].avgRating = (currentTotal + booking.feedback_rating) / periodMetrics[periodKey].ratingCount;
      }
    });
  });

  // Calculate overall metrics
  const allPeriods = Object.values(periodMetrics);
  const totalSessions = allPeriods.reduce((sum, p) => sum + p.sessions, 0);
  const totalBookings = allPeriods.reduce((sum, p) => sum + p.totalBookings, 0);
  const totalAttended = allPeriods.reduce((sum, p) => sum + p.attended, 0);
  const totalNoShows = allPeriods.reduce((sum, p) => sum + p.noShows, 0);
  const totalResolved = allPeriods.reduce((sum, p) => sum + p.resolved, 0);

  let overallAvgRating: number | null = null;
  const ratingSum = allPeriods.reduce((sum, p) => sum + (p.avgRating || 0) * p.ratingCount, 0);
  const ratingCount = allPeriods.reduce((sum, p) => sum + p.ratingCount, 0);
  if (ratingCount > 0) {
    overallAvgRating = ratingSum / ratingCount;
  }

  return NextResponse.json({
    period,
    summary: {
      totalSessions,
      totalBookings,
      attended: totalAttended,
      noShows: totalNoShows,
      resolved: totalResolved,
      attendanceRate: totalBookings > 0 ? ((totalAttended / totalBookings) * 100).toFixed(1) : '0',
      resolutionRate: totalAttended > 0 ? ((totalResolved / totalAttended) * 100).toFixed(1) : '0',
      avgRating: overallAvgRating ? overallAvgRating.toFixed(2) : null,
      ratingCount,
    },
    periodData: allPeriods.sort((a, b) => a.period.localeCompare(b.period)),
  });
}
