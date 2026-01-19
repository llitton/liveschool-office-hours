import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { subDays, startOfDay } from 'date-fns';

// Funnel step order
const FUNNEL_STEPS = [
  'page_view',
  'slot_selection',
  'form_start',
  'form_submit',
  'booking_created',
] as const;

type FunnelStep = (typeof FUNNEL_STEPS)[number];

interface FunnelStepData {
  step: FunnelStep;
  count: number;
  dropOffRate: number | null; // Percentage that dropped from previous step
  conversionRate: number | null; // Percentage of page_views that reached this step
}

interface EventBreakdown {
  eventId: string;
  eventName: string;
  eventSlug: string;
  pageViews: number;
  bookings: number;
  conversionRate: number;
}

// GET conversion funnel analytics
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get('period') || 'month'; // week, month, all
  const eventId = searchParams.get('eventId'); // Optional event filter

  const supabase = getServiceSupabase();

  // Calculate date range
  let startDate: Date | null = null;
  if (period === 'week') {
    startDate = startOfDay(subDays(new Date(), 7));
  } else if (period === 'month') {
    startDate = startOfDay(subDays(new Date(), 30));
  }
  // 'all' means no date filter

  // Build base query
  let query = supabase
    .from('oh_booking_analytics')
    .select('session_id, event_type, event_id, event_slug, event_name, created_at');

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by session to track unique visitors through the funnel
  const sessionData = new Map<
    string,
    {
      steps: Set<FunnelStep>;
      eventId?: string;
      eventSlug?: string;
      eventName?: string;
    }
  >();

  for (const event of events || []) {
    const sessionId = event.session_id;
    if (!sessionData.has(sessionId)) {
      sessionData.set(sessionId, {
        steps: new Set(),
        eventId: event.event_id,
        eventSlug: event.event_slug,
        eventName: event.event_name,
      });
    }
    const data = sessionData.get(sessionId)!;
    if (FUNNEL_STEPS.includes(event.event_type as FunnelStep)) {
      data.steps.add(event.event_type as FunnelStep);
    }
    // Keep the most specific event info
    if (event.event_id) data.eventId = event.event_id;
    if (event.event_slug) data.eventSlug = event.event_slug;
    if (event.event_name) data.eventName = event.event_name;
  }

  // Calculate overall funnel counts
  const funnelCounts: Record<FunnelStep, number> = {
    page_view: 0,
    slot_selection: 0,
    form_start: 0,
    form_submit: 0,
    booking_created: 0,
  };

  // Count unique sessions at each step
  for (const [, data] of sessionData) {
    for (const step of FUNNEL_STEPS) {
      if (data.steps.has(step)) {
        funnelCounts[step]++;
      }
    }
  }

  // Calculate funnel data with drop-off rates
  const funnelData: FunnelStepData[] = FUNNEL_STEPS.map((step, index) => {
    const count = funnelCounts[step];
    const prevCount = index > 0 ? funnelCounts[FUNNEL_STEPS[index - 1]] : null;
    const pageViews = funnelCounts.page_view;

    return {
      step,
      count,
      dropOffRate:
        prevCount !== null && prevCount > 0
          ? Math.round(((prevCount - count) / prevCount) * 100)
          : null,
      conversionRate:
        pageViews > 0 ? Math.round((count / pageViews) * 100 * 10) / 10 : null,
    };
  });

  // Calculate per-event breakdown
  const eventStats = new Map<
    string,
    { eventName: string; eventSlug: string; pageViews: number; bookings: number }
  >();

  for (const [, data] of sessionData) {
    if (!data.eventId || !data.eventSlug) continue;

    const key = data.eventId;
    if (!eventStats.has(key)) {
      eventStats.set(key, {
        eventName: data.eventName || data.eventSlug,
        eventSlug: data.eventSlug,
        pageViews: 0,
        bookings: 0,
      });
    }

    const stats = eventStats.get(key)!;
    if (data.steps.has('page_view')) stats.pageViews++;
    if (data.steps.has('booking_created')) stats.bookings++;
  }

  const eventBreakdown: EventBreakdown[] = Array.from(eventStats.entries())
    .map(([eventId, stats]) => ({
      eventId,
      eventName: stats.eventName,
      eventSlug: stats.eventSlug,
      pageViews: stats.pageViews,
      bookings: stats.bookings,
      conversionRate:
        stats.pageViews > 0
          ? Math.round((stats.bookings / stats.pageViews) * 100 * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.pageViews - a.pageViews);

  // Calculate top drop-off points
  const dropOffPoints = funnelData
    .filter((f) => f.dropOffRate !== null)
    .map((f) => ({
      from:
        FUNNEL_STEPS[FUNNEL_STEPS.indexOf(f.step) - 1]
          ?.replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()) || '',
      to: f.step.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      rate: f.dropOffRate!,
    }))
    .sort((a, b) => b.rate - a.rate);

  // Overall stats
  const totalPageViews = funnelCounts.page_view;
  const totalBookings = funnelCounts.booking_created;
  const overallConversionRate =
    totalPageViews > 0
      ? Math.round((totalBookings / totalPageViews) * 100 * 10) / 10
      : 0;
  const overallDropOffRate =
    totalPageViews > 0
      ? Math.round(((totalPageViews - totalBookings) / totalPageViews) * 100 * 10) / 10
      : 0;

  // Get daily trend data
  const dailyData = new Map<string, { pageViews: number; bookings: number }>();

  for (const event of events || []) {
    const day = event.created_at.split('T')[0];
    if (!dailyData.has(day)) {
      dailyData.set(day, { pageViews: 0, bookings: 0 });
    }
    const data = dailyData.get(day)!;
    if (event.event_type === 'page_view') data.pageViews++;
    if (event.event_type === 'booking_created') data.bookings++;
  }

  const trends = Array.from(dailyData.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    summary: {
      pageViews: totalPageViews,
      bookings: totalBookings,
      conversionRate: overallConversionRate,
      dropOffRate: overallDropOffRate,
    },
    funnel: funnelData,
    topDropOffs: dropOffPoints.slice(0, 3),
    eventBreakdown,
    trends,
    period,
  });
}
