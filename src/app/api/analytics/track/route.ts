import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import type { BookingAnalyticsEventType } from '@/types';

// Valid event types that can be tracked
const VALID_EVENT_TYPES: BookingAnalyticsEventType[] = [
  'page_view',
  'slot_selection',
  'form_start',
  'form_submit',
  'booking_created',
  'booking_failed',
];

// Rate limit: max 50 events per session per minute
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(sessionId, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (entry.count >= 50) {
    return false;
  }

  entry.count++;
  return true;
}

// POST - Track a booking funnel event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { session_id, event_type, event_slug } = body;

    if (!session_id || typeof session_id !== 'string' || session_id.length > 64) {
      return NextResponse.json(
        { error: 'Invalid session_id' },
        { status: 400 }
      );
    }

    if (!event_type || !VALID_EVENT_TYPES.includes(event_type)) {
      return NextResponse.json(
        { error: 'Invalid event_type' },
        { status: 400 }
      );
    }

    if (!event_slug || typeof event_slug !== 'string') {
      return NextResponse.json(
        { error: 'Invalid event_slug' },
        { status: 400 }
      );
    }

    // Rate limiting
    if (!checkRateLimit(session_id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const supabase = getServiceSupabase();

    // Look up event by slug to get event_id
    let eventId: string | null = null;
    if (event_slug) {
      const { data: eventData } = await supabase
        .from('oh_events')
        .select('id')
        .eq('slug', event_slug)
        .single();

      eventId = eventData?.id || null;
    }

    // Sanitize and prepare the record
    const record = {
      session_id: session_id.slice(0, 64),
      event_type,
      event_slug: event_slug?.slice(0, 255) || null,
      event_id: eventId || body.event_id || null,
      event_name: body.event_name?.slice(0, 255) || null,
      slot_id: body.slot_id || null,
      booking_id: body.booking_id || null,
      selected_slot_time: body.selected_slot_time || null,
      referrer_url: body.referrer_url?.slice(0, 2000) || null,
      utm_source: body.utm_source?.slice(0, 100) || null,
      utm_medium: body.utm_medium?.slice(0, 100) || null,
      utm_campaign: body.utm_campaign?.slice(0, 100) || null,
      device_type: body.device_type?.slice(0, 20) || null,
      browser_name: body.browser_name?.slice(0, 50) || null,
      visitor_timezone: body.visitor_timezone?.slice(0, 100) || null,
      error_code: body.error_code?.slice(0, 50) || null,
      error_message: body.error_message?.slice(0, 500) || null,
    };

    // Insert the analytics event
    const { error } = await supabase
      .from('oh_booking_analytics')
      .insert(record);

    if (error) {
      console.error('Failed to track analytics event:', error);
      // Don't expose internal errors
      return NextResponse.json({ success: false }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics track error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
