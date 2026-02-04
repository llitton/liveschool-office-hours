import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Booking Health Check Endpoint
 *
 * Tests the critical path that was broken:
 * 1. Can we query slots?
 * 2. Can we join slots with events?
 * 3. Can we count bookings?
 *
 * Use this for monitoring to catch database query issues early.
 *
 * GET /api/health/booking
 * Returns: { status: 'ok' | 'error', checks: {...}, latency_ms: number }
 */
export async function GET() {
  const startTime = Date.now();
  const supabase = getServiceSupabase();

  const checks: Record<string, { status: 'ok' | 'error'; message?: string; latency_ms?: number }> = {};

  // Check 1: Can we query slots table?
  try {
    const slotStart = Date.now();
    const { data: slots, error: slotsError } = await supabase
      .from('oh_slots')
      .select('id, event_id')
      .limit(1);

    if (slotsError) {
      checks.slots_query = { status: 'error', message: 'Slots query failed' };
    } else {
      checks.slots_query = { status: 'ok', latency_ms: Date.now() - slotStart };
    }
  } catch (err) {
    checks.slots_query = { status: 'error', message: 'Check failed' };
  }

  // Check 2: Can we join slots with events? (This is what broke)
  try {
    const joinStart = Date.now();
    const { data: slotWithEvent, error: joinError } = await supabase
      .from('oh_slots')
      .select(`
        id,
        event_id,
        event:oh_events!event_id(id, name, slug)
      `)
      .limit(1)
      .single();

    if (joinError && joinError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      checks.slot_event_join = { status: 'error', message: 'Slot-event join failed' };
    } else if (slotWithEvent && !slotWithEvent.event) {
      checks.slot_event_join = { status: 'error', message: 'Join returned null event' };
    } else {
      checks.slot_event_join = { status: 'ok', latency_ms: Date.now() - joinStart };
    }
  } catch (err) {
    checks.slot_event_join = { status: 'error', message: 'Check failed' };
  }

  // Check 3: Can we count bookings?
  try {
    const countStart = Date.now();
    const { count, error: countError } = await supabase
      .from('oh_bookings')
      .select('*', { count: 'exact', head: true })
      .limit(1);

    if (countError) {
      checks.bookings_count = { status: 'error', message: 'Bookings count failed' };
    } else {
      checks.bookings_count = { status: 'ok', latency_ms: Date.now() - countStart };
    }
  } catch (err) {
    checks.bookings_count = { status: 'error', message: 'Check failed' };
  }

  // Check 4: Test the exact query used in booking creation
  try {
    const bookingQueryStart = Date.now();
    const { data: slot, error: slotError } = await supabase
      .from('oh_slots')
      .select(`
        *,
        event:oh_events!event_id(*),
        bookings:oh_bookings!slot_id(count)
      `)
      .eq('is_cancelled', false)
      .limit(1)
      .single();

    if (slotError && slotError.code !== 'PGRST116') {
      checks.booking_slot_query = { status: 'error', message: 'Booking slot query failed' };
    } else if (slot && !slot.event) {
      checks.booking_slot_query = { status: 'error', message: 'Booking query returned null event' };
    } else {
      checks.booking_slot_query = { status: 'ok', latency_ms: Date.now() - bookingQueryStart };
    }
  } catch (err) {
    checks.booking_slot_query = { status: 'error', message: 'Check failed' };
  }

  // Determine overall status
  const hasErrors = Object.values(checks).some(c => c.status === 'error');
  const status = hasErrors ? 'error' : 'ok';

  const response = {
    status,
    checks,
    latency_ms: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    status: hasErrors ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
