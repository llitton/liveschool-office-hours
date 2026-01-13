import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

// GET topic trends over time
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const days = parseInt(searchParams.get('days') || '30', 10);

  const supabase = getServiceSupabase();

  const startDate = startOfDay(subDays(new Date(), days));
  const endDate = endOfDay(new Date());

  // Build query
  let query = supabase
    .from('oh_bookings')
    .select(`
      id,
      created_at,
      question_responses,
      status,
      slot:oh_slots!inner(
        start_time,
        event:oh_events!inner(id, name)
      )
    `)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .is('cancelled_at', null);

  if (eventId) {
    query = query.eq('slot.event_id', eventId);
  }

  const { data: bookings, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by day
  const dailyStats: Record<string, { date: string; bookings: number; attended: number; noShow: number }> = {};

  // Initialize all days in range
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateKey = format(d, 'yyyy-MM-dd');
    dailyStats[dateKey] = { date: dateKey, bookings: 0, attended: 0, noShow: 0 };
  }

  // Count bookings per day
  bookings?.forEach((booking) => {
    const dateKey = format(new Date(booking.created_at), 'yyyy-MM-dd');
    if (dailyStats[dateKey]) {
      dailyStats[dateKey].bookings++;
      if (booking.status === 'attended') {
        dailyStats[dateKey].attended++;
      } else if (booking.status === 'no_show') {
        dailyStats[dateKey].noShow++;
      }
    }
  });

  // Extract and count topics
  const topicCounts: Record<string, number> = {};

  bookings?.forEach((booking) => {
    const responses = booking.question_responses as Record<string, string> || {};
    Object.values(responses).forEach((response) => {
      if (typeof response === 'string' && response.length > 0) {
        // Extract key topics (simple keyword extraction)
        const words = response.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 3);

        words.forEach((word) => {
          topicCounts[word] = (topicCounts[word] || 0) + 1;
        });
      }
    });
  });

  // Get top topics
  const topTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([topic, count]) => ({ topic, count }));

  // Calculate summary stats
  const totalBookings = bookings?.length || 0;
  const attendedCount = bookings?.filter((b) => b.status === 'attended').length || 0;
  const noShowCount = bookings?.filter((b) => b.status === 'no_show').length || 0;

  return NextResponse.json({
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      days,
    },
    summary: {
      totalBookings,
      attended: attendedCount,
      noShow: noShowCount,
      attendanceRate: totalBookings > 0 ? ((attendedCount / totalBookings) * 100).toFixed(1) : '0',
    },
    dailyData: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
    topTopics,
  });
}
