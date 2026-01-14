import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/google';

// POST send a help article/resource to attendee
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await params;
  const body = await request.json();
  const { resourceId, customMessage } = body;

  if (!resourceId) {
    return NextResponse.json(
      { error: 'resourceId is required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get the booking with slot and event info
  const { data: booking, error: bookingError } = await supabase
    .from('oh_bookings')
    .select(`
      id,
      email,
      first_name,
      last_name,
      slot:oh_slots(
        event_id,
        event:oh_events(
          name,
          host_name,
          host_email
        )
      )
    `)
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Handle nested event type - Supabase may return array or object
  const slotRaw = booking.slot as unknown;
  const slotData = Array.isArray(slotRaw) ? slotRaw[0] : slotRaw;
  const slot = slotData as {
    event_id: string;
    event?: { name: string; host_name: string; host_email: string }[] | { name: string; host_name: string; host_email: string };
  } | null;
  const eventRaw = slot?.event;
  const event = Array.isArray(eventRaw) ? eventRaw[0] : eventRaw;

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Get the resource
  const { data: resource, error: resourceError } = await supabase
    .from('oh_prep_resources')
    .select('*')
    .eq('id', resourceId)
    .single();

  if (resourceError || !resource) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  // Get admin tokens for sending email
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('google_access_token, google_refresh_token')
    .eq('email', event.host_email)
    .single();

  if (!admin?.google_access_token || !admin?.google_refresh_token) {
    return NextResponse.json(
      { error: 'Email not configured for host' },
      { status: 400 }
    );
  }

  // Build the email
  const htmlBody = `
    <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
      <p>Hi ${booking.first_name},</p>

      <p>Following up on our ${event.name} session, I wanted to share this resource with you:</p>

      <div style="background: #F6F6F9; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #101E57;">${resource.title}</h3>
        <p style="color: #667085; margin-bottom: 12px;">${resource.content}</p>
        ${resource.link ? `<a href="${resource.link}" style="display: inline-block; background: #6F71EE; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View Resource</a>` : ''}
      </div>

      ${customMessage ? `<p>${customMessage}</p>` : ''}

      <p>Let me know if you have any questions!</p>

      <p>Best,<br/>${event.host_name}</p>

      <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; margin-top: 20px; text-align: center;">
        <p style="color: #98A2B3; font-size: 12px; margin: 0;">
          Sent from LiveSchool Office Hours
        </p>
      </div>
    </div>
  `;

  try {
    await sendEmail(admin.google_access_token, admin.google_refresh_token, {
      to: booking.email,
      subject: `Resource from ${event.name}: ${resource.title}`,
      replyTo: event.host_email,
      htmlBody,
    });

    // Log the resource send
    await supabase.from('oh_resource_sends').insert({
      booking_id: bookingId,
      resource_id: resourceId,
      sent_by: session.email,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to send resource email:', err);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
