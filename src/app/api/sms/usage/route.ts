import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, format } from 'date-fns';

// GET /api/sms/usage - Get SMS usage statistics
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get('period') || 'month'; // 'week', 'month', 'all'

  const supabase = getServiceSupabase();
  const now = new Date();

  // Calculate date range based on period
  let startDate: Date;
  let endDate: Date = now;

  if (period === 'week') {
    startDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    endDate = endOfWeek(now, { weekStartsOn: 1 });
  } else if (period === 'month') {
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
  } else {
    // All time - go back 1 year
    startDate = subDays(now, 365);
  }

  // Get all logs in the period
  const { data: logs, error } = await supabase
    .from('oh_sms_logs')
    .select(`
      id,
      status,
      segment_count,
      message_type,
      event_id,
      created_at,
      event:oh_events(id, name)
    `)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching SMS usage:', error);
    return NextResponse.json({ error: 'Failed to fetch SMS usage' }, { status: 500 });
  }

  // Calculate statistics
  let totalSent = 0;
  let totalDelivered = 0;
  let totalFailed = 0;
  let totalSegments = 0;

  const byEvent: Map<string, { eventId: string; eventName: string; count: number }> = new Map();
  const byDay: Map<string, { sent: number; delivered: number; failed: number }> = new Map();
  const byType: Record<string, number> = {
    reminder_24h: 0,
    reminder_1h: 0,
    test: 0,
    custom: 0,
  };

  for (const log of logs || []) {
    // Status counts
    if (log.status === 'sent') {
      totalSent++;
    } else if (log.status === 'delivered') {
      totalDelivered++;
      totalSent++; // Delivered also counts as sent
    } else if (log.status === 'failed') {
      totalFailed++;
    }

    // Segment count
    totalSegments += log.segment_count || 1;

    // By event
    if (log.event_id && log.event) {
      const existing = byEvent.get(log.event_id);
      if (existing) {
        existing.count++;
      } else {
        // Supabase returns relation as array, get first element
        const eventData = Array.isArray(log.event) ? log.event[0] : log.event;
        if (eventData) {
          byEvent.set(log.event_id, {
            eventId: log.event_id,
            eventName: eventData.name,
            count: 1,
          });
        }
      }
    }

    // By day
    const day = format(new Date(log.created_at), 'yyyy-MM-dd');
    const dayStats = byDay.get(day) || { sent: 0, delivered: 0, failed: 0 };
    if (log.status === 'sent' || log.status === 'delivered') {
      dayStats.sent++;
    }
    if (log.status === 'delivered') {
      dayStats.delivered++;
    }
    if (log.status === 'failed') {
      dayStats.failed++;
    }
    byDay.set(day, dayStats);

    // By type
    if (log.message_type && byType[log.message_type] !== undefined) {
      byType[log.message_type]++;
    }
  }

  // Calculate delivery rate
  const totalAttempted = totalSent + totalFailed;
  const deliveryRate = totalAttempted > 0 ? (totalDelivered / totalAttempted) * 100 : 0;

  // Convert maps to arrays and sort
  const byEventArray = Array.from(byEvent.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 events

  const byDayArray = Array.from(byDay.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    totalSent,
    totalDelivered,
    totalFailed,
    deliveryRate: Math.round(deliveryRate * 10) / 10, // 1 decimal place
    totalSegments,
    byEvent: byEventArray,
    byDay: byDayArray,
    byType,
  });
}
