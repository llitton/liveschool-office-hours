import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { generateICalFile } from '@/lib/ical';
import { parseISO } from 'date-fns';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getServiceSupabase();

  // Get booking with slot and event
  const { data: booking, error } = await supabase
    .from('oh_bookings')
    .select(`
      *,
      slot:oh_slots(
        *,
        event:oh_events(*)
      )
    `)
    .eq('manage_token', token)
    .is('cancelled_at', null)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const { slot, slot: { event } } = booking;

  // Generate iCal file
  const icalContent = generateICalFile({
    title: event.name,
    description: `${event.description || ''}\n\n${slot.google_meet_link ? `Join: ${slot.google_meet_link}` : ''}`.trim(),
    location: slot.google_meet_link || 'Google Meet',
    startTime: parseISO(slot.start_time),
    endTime: parseISO(slot.end_time),
    organizer: {
      name: event.host_name,
      email: event.host_email,
    },
  });

  // Return as downloadable file
  return new NextResponse(icalContent, {
    headers: {
      'Content-Type': 'text/calendar',
      'Content-Disposition': `attachment; filename="${event.name.replace(/[^a-zA-Z0-9]/g, '-')}.ics"`,
    },
  });
}
