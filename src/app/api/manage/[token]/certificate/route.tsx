import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { renderToBuffer } from '@react-pdf/renderer';
import CertificateDocument from '@/components/CertificateDocument';

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
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Certificate only available for attended sessions
  if (booking.cancelled_at) {
    return NextResponse.json({ error: 'Booking was cancelled' }, { status: 400 });
  }

  if (!booking.attended_at) {
    return NextResponse.json(
      { error: 'Certificate only available after session attendance is confirmed' },
      { status: 400 }
    );
  }

  const { slot } = booking;
  const event = slot.event;

  // Generate a short certificate ID from the booking ID
  const certificateId = `LS-${booking.id.substring(0, 8).toUpperCase()}`;

  // Generate PDF
  const pdfBuffer = await renderToBuffer(
    <CertificateDocument
      attendeeName={`${booking.first_name} ${booking.last_name}`}
      eventName={event.name}
      eventDate={slot.start_time}
      duration={event.duration_minutes}
      hostName={event.host_name}
      certificateId={certificateId}
    />
  );

  // Return as downloadable PDF
  const fileName = `certificate-${booking.first_name}-${booking.last_name}`.replace(/[^a-zA-Z0-9-]/g, '-');

  // Convert Node.js Buffer to Uint8Array for NextResponse
  const uint8Array = new Uint8Array(pdfBuffer);

  return new NextResponse(uint8Array, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}.pdf"`,
    },
  });
}
