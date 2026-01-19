import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { subDays, startOfDay, format } from 'date-fns';

const FUNNEL_STEPS = [
  'page_view',
  'slot_selection',
  'form_start',
  'form_submit',
  'booking_created',
] as const;

type FunnelStep = (typeof FUNNEL_STEPS)[number];

const STEP_LABELS: Record<FunnelStep, string> = {
  page_view: 'Page View',
  slot_selection: 'Slot Selection',
  form_start: 'Form Start',
  form_submit: 'Form Submit',
  booking_created: 'Booking Created',
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get('period') || 'month';
  const eventId = searchParams.get('eventId');

  const supabase = getServiceSupabase();

  // Calculate date range
  let startDate: Date | null = null;
  if (period === 'week') {
    startDate = startOfDay(subDays(new Date(), 7));
  } else if (period === 'month') {
    startDate = startOfDay(subDays(new Date(), 30));
  }

  // Build query
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

  // Group by session
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
    if (event.event_id) data.eventId = event.event_id;
    if (event.event_slug) data.eventSlug = event.event_slug;
    if (event.event_name) data.eventName = event.event_name;
  }

  // Calculate funnel counts
  const funnelCounts: Record<FunnelStep, number> = {
    page_view: 0,
    slot_selection: 0,
    form_start: 0,
    form_submit: 0,
    booking_created: 0,
  };

  for (const [, data] of sessionData) {
    for (const step of FUNNEL_STEPS) {
      if (data.steps.has(step)) {
        funnelCounts[step]++;
      }
    }
  }

  // Calculate per-event stats
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

  // Daily trends
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

  // Build CSV sections
  const csvRows: string[][] = [];

  // Summary section
  const pageViews = funnelCounts.page_view;
  const bookings = funnelCounts.booking_created;
  const conversionRate = pageViews > 0 ? ((bookings / pageViews) * 100).toFixed(1) : '0';

  csvRows.push(['SUMMARY']);
  csvRows.push(['Metric', 'Value']);
  csvRows.push(['Page Views', pageViews.toString()]);
  csvRows.push(['Bookings', bookings.toString()]);
  csvRows.push(['Conversion Rate', `${conversionRate}%`]);
  csvRows.push(['Period', period === 'all' ? 'All Time' : period === 'week' ? 'Past 7 Days' : 'Past 30 Days']);
  csvRows.push([]);

  // Funnel section
  csvRows.push(['FUNNEL BREAKDOWN']);
  csvRows.push(['Step', 'Count', 'Drop-off %', 'Conversion %']);
  FUNNEL_STEPS.forEach((step, index) => {
    const count = funnelCounts[step];
    const prevCount = index > 0 ? funnelCounts[FUNNEL_STEPS[index - 1]] : null;
    const dropOff = prevCount && prevCount > 0 ? (((prevCount - count) / prevCount) * 100).toFixed(1) : '-';
    const conversion = pageViews > 0 ? ((count / pageViews) * 100).toFixed(1) : '0';
    csvRows.push([STEP_LABELS[step], count.toString(), `${dropOff}%`, `${conversion}%`]);
  });
  csvRows.push([]);

  // Event breakdown section
  csvRows.push(['BY EVENT']);
  csvRows.push(['Event Name', 'Slug', 'Page Views', 'Bookings', 'Conversion Rate']);
  const sortedEvents = Array.from(eventStats.entries()).sort((a, b) => b[1].pageViews - a[1].pageViews);
  for (const [, stats] of sortedEvents) {
    const rate = stats.pageViews > 0 ? ((stats.bookings / stats.pageViews) * 100).toFixed(1) : '0';
    csvRows.push([stats.eventName, stats.eventSlug, stats.pageViews.toString(), stats.bookings.toString(), `${rate}%`]);
  }
  csvRows.push([]);

  // Daily trends section
  csvRows.push(['DAILY TRENDS']);
  csvRows.push(['Date', 'Page Views', 'Bookings']);
  const sortedDays = Array.from(dailyData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [date, data] of sortedDays) {
    csvRows.push([date, data.pageViews.toString(), data.bookings.toString()]);
  }

  // Build CSV content
  const csvContent = csvRows
    .map((row) => row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const filename = `conversions-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`;

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
