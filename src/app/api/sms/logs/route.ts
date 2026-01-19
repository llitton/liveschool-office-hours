import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// GET /api/sms/logs - Get paginated SMS logs with filtering
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const status = searchParams.get('status'); // 'sent', 'delivered', 'failed'
  const eventId = searchParams.get('event_id');
  const messageType = searchParams.get('type'); // 'reminder_24h', 'reminder_1h', 'test'
  const search = searchParams.get('search'); // Search by phone or name
  const from = searchParams.get('from'); // ISO date string
  const to = searchParams.get('to'); // ISO date string

  const supabase = getServiceSupabase();
  const offset = (page - 1) * limit;

  // Build the query
  let query = supabase
    .from('oh_sms_logs')
    .select(`
      *,
      event:oh_events(id, name, slug)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  // Apply filters
  if (status) {
    query = query.eq('status', status);
  }

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  if (messageType) {
    query = query.eq('message_type', messageType);
  }

  if (from) {
    query = query.gte('created_at', from);
  }

  if (to) {
    query = query.lte('created_at', to);
  }

  if (search) {
    // Search by phone number or recipient name
    query = query.or(`recipient_phone.ilike.%${search}%,recipient_name.ilike.%${search}%`);
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data: logs, error, count } = await query;

  if (error) {
    console.error('Error fetching SMS logs:', error);
    return NextResponse.json({ error: 'Failed to fetch SMS logs' }, { status: 500 });
  }

  // Get summary counts for current filter
  let summaryQuery = supabase
    .from('oh_sms_logs')
    .select('status', { count: 'exact', head: false });

  // Apply the same filters (except status) for summary
  if (eventId) {
    summaryQuery = summaryQuery.eq('event_id', eventId);
  }
  if (messageType) {
    summaryQuery = summaryQuery.eq('message_type', messageType);
  }
  if (from) {
    summaryQuery = summaryQuery.gte('created_at', from);
  }
  if (to) {
    summaryQuery = summaryQuery.lte('created_at', to);
  }
  if (search) {
    summaryQuery = summaryQuery.or(`recipient_phone.ilike.%${search}%,recipient_name.ilike.%${search}%`);
  }

  const { data: allLogs } = await summaryQuery;

  // Calculate summary
  const summary = {
    sent: 0,
    delivered: 0,
    failed: 0,
  };

  if (allLogs) {
    for (const log of allLogs) {
      if (log.status === 'sent') summary.sent++;
      else if (log.status === 'delivered') summary.delivered++;
      else if (log.status === 'failed') summary.failed++;
    }
  }

  return NextResponse.json({
    logs: logs || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
    summary,
  });
}
