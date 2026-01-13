import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// GET series details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seriesId } = await params;
  const supabase = getServiceSupabase();

  const { data: series, error } = await supabase
    .from('oh_booking_series')
    .select(`
      *,
      event:oh_events(name, slug, description),
      bookings:oh_bookings(
        *,
        slot:oh_slots(start_time, end_time, google_meet_link)
      )
    `)
    .eq('id', seriesId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!series) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 });
  }

  // Sort bookings by sequence
  series.bookings = series.bookings?.sort(
    (a: { series_sequence: number }, b: { series_sequence: number }) =>
      (a.series_sequence || 0) - (b.series_sequence || 0)
  );

  return NextResponse.json(series);
}

// DELETE cancel entire series
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seriesId } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  const supabase = getServiceSupabase();

  // Get series with bookings
  const { data: series, error: seriesError } = await supabase
    .from('oh_booking_series')
    .select(`
      *,
      bookings:oh_bookings(id, manage_token, cancelled_at)
    `)
    .eq('id', seriesId)
    .single();

  if (seriesError || !series) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 });
  }

  // Verify authorization - check if any booking's manage_token matches
  const validBooking = series.bookings?.find(
    (b: { manage_token: string }) => b.manage_token === token
  );

  if (!token || !validBooking) {
    return NextResponse.json({ error: 'Invalid authorization' }, { status: 401 });
  }

  // Cancel all uncancelled bookings in the series
  const bookingIds = series.bookings
    ?.filter((b: { cancelled_at: string | null }) => !b.cancelled_at)
    .map((b: { id: string }) => b.id);

  if (bookingIds && bookingIds.length > 0) {
    const { error: cancelError } = await supabase
      .from('oh_bookings')
      .update({ cancelled_at: new Date().toISOString() })
      .in('id', bookingIds);

    if (cancelError) {
      return NextResponse.json({ error: cancelError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    cancelledCount: bookingIds?.length || 0,
  });
}

// PATCH update series (e.g., cancel remaining sessions)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seriesId } = await params;
  const body = await request.json();
  const { token, cancel_remaining = false } = body;

  const supabase = getServiceSupabase();

  // Get series with bookings
  const { data: series, error: seriesError } = await supabase
    .from('oh_booking_series')
    .select(`
      *,
      bookings:oh_bookings(id, manage_token, cancelled_at, slot:oh_slots(start_time))
    `)
    .eq('id', seriesId)
    .single();

  if (seriesError || !series) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 });
  }

  // Verify authorization
  const validBooking = series.bookings?.find(
    (b: { manage_token: string }) => b.manage_token === token
  );

  if (!token || !validBooking) {
    return NextResponse.json({ error: 'Invalid authorization' }, { status: 401 });
  }

  if (cancel_remaining) {
    // Cancel only future, uncancelled bookings
    const now = new Date();
    const futureBookingIds = series.bookings
      ?.filter((b: { cancelled_at: string | null; slot: { start_time: string } }) => {
        if (b.cancelled_at) return false;
        const slotTime = new Date(b.slot.start_time);
        return slotTime > now;
      })
      .map((b: { id: string }) => b.id);

    if (futureBookingIds && futureBookingIds.length > 0) {
      const { error: cancelError } = await supabase
        .from('oh_bookings')
        .update({ cancelled_at: new Date().toISOString() })
        .in('id', futureBookingIds);

      if (cancelError) {
        return NextResponse.json({ error: cancelError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      cancelledCount: futureBookingIds?.length || 0,
    });
  }

  return NextResponse.json({ success: true });
}
