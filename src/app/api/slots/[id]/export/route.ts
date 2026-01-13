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

  // Get slot with event and bookings
  const { data: slot, error } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(name, host_name),
      bookings:oh_bookings(*)
    `)
    .eq('id', id)
    .single();

  if (error || !slot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }

  const activeBookings = (slot.bookings || []).filter(
    (b: { cancelled_at: string | null }) => !b.cancelled_at
  );

  // Create CSV
  const headers = ['First Name', 'Last Name', 'Email', 'Booked At', 'Confirmation Sent', 'Calendar Invite Sent'];
  const rows = activeBookings.map((b: {
    first_name: string;
    last_name: string;
    email: string;
    created_at: string;
    confirmation_sent_at: string | null;
    calendar_invite_sent_at: string | null;
  }) => [
    b.first_name,
    b.last_name,
    b.email,
    format(parseISO(b.created_at), 'yyyy-MM-dd HH:mm'),
    b.confirmation_sent_at ? 'Yes' : 'No',
    b.calendar_invite_sent_at ? 'Yes' : 'No',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(',')),
  ].join('\n');

  const slotDate = format(parseISO(slot.start_time), 'yyyy-MM-dd');
  const filename = `attendees-${slot.event.name.replace(/[^a-z0-9]/gi, '-')}-${slotDate}.csv`;

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
