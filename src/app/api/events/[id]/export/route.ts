import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { format, parseISO } from 'date-fns';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  // Get event with all slots and bookings
  const { data: event, error } = await supabase
    .from('oh_events')
    .select(`
      *,
      slots:oh_slots(
        *,
        bookings:oh_bookings(*)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Flatten all bookings with slot info
  const allBookings: Array<{
    first_name: string;
    last_name: string;
    email: string;
    session_date: string;
    session_time: string;
    booked_at: string;
    status: string;
  }> = [];

  for (const slot of event.slots || []) {
    for (const booking of slot.bookings || []) {
      allBookings.push({
        first_name: booking.first_name,
        last_name: booking.last_name,
        email: booking.email,
        session_date: format(parseISO(slot.start_time), 'yyyy-MM-dd'),
        session_time: format(parseISO(slot.start_time), 'h:mm a'),
        booked_at: format(parseISO(booking.created_at), 'yyyy-MM-dd HH:mm'),
        status: booking.cancelled_at ? 'Cancelled' : slot.is_cancelled ? 'Session Cancelled' : 'Confirmed',
      });
    }
  }

  // Sort by session date, then by booking date
  allBookings.sort((a, b) => {
    const dateCompare = a.session_date.localeCompare(b.session_date);
    if (dateCompare !== 0) return dateCompare;
    return a.booked_at.localeCompare(b.booked_at);
  });

  // Create CSV
  const headers = ['First Name', 'Last Name', 'Email', 'Session Date', 'Session Time', 'Booked At', 'Status'];
  const rows = allBookings.map((b) => [
    b.first_name,
    b.last_name,
    b.email,
    b.session_date,
    b.session_time,
    b.booked_at,
    b.status,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const filename = `all-bookings-${event.name.replace(/[^a-z0-9]/gi, '-')}.csv`;

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
