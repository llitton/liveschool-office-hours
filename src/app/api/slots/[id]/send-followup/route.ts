import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/google';
import { htmlifyEmailBody } from '@/lib/email-templates';

// POST send bulk follow-up emails to attendees or no-shows
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { recipients, subject, body: emailBody } = body;

  if (!recipients || !subject || !emailBody) {
    return NextResponse.json(
      { error: 'recipients, subject, and body are required' },
      { status: 400 }
    );
  }

  if (!['attended', 'no_show'].includes(recipients)) {
    return NextResponse.json(
      { error: 'recipients must be "attended" or "no_show"' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get the slot with event and bookings
  const { data: slot, error: slotError } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(*)
    `)
    .eq('id', id)
    .single();

  if (slotError || !slot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }

  // Filter bookings based on recipient type
  const targetBookings = (slot.bookings || []).filter(
    (b: { cancelled_at: string | null; attended_at: string | null; no_show_at: string | null }) => {
      if (b.cancelled_at) return false;
      if (recipients === 'attended') return !!b.attended_at;
      if (recipients === 'no_show') return !!b.no_show_at;
      return false;
    }
  );

  if (targetBookings.length === 0) {
    return NextResponse.json(
      { error: `No ${recipients === 'attended' ? 'attendees' : 'no-shows'} to email` },
      { status: 400 }
    );
  }

  // Get admin credentials for sending email
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('email', slot.event.host_email)
    .single();

  if (!admin?.google_access_token || !admin?.google_refresh_token) {
    return NextResponse.json(
      { error: 'Host email not configured. Please connect Google in integrations.' },
      { status: 400 }
    );
  }

  // Send emails
  const results = await Promise.allSettled(
    targetBookings.map(async (booking: { first_name: string; email: string }) => {
      // Replace {{first_name}} placeholder if present
      const personalizedBody = emailBody.replace(/\{\{first_name\}\}/g, booking.first_name);

      const htmlBody = `
        <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
          ${htmlifyEmailBody(personalizedBody)}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 12px; color: #667085;">
            Sent from Connect with LiveSchool
          </p>
        </div>
      `;

      await sendEmail(
        admin.google_access_token!,
        admin.google_refresh_token!,
        {
          to: booking.email,
          subject,
          replyTo: slot.event.host_email,
          htmlBody,
        }
      );

      return booking.email;
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`Follow-up emails for slot ${id}: sent ${sent}, failed ${failed}`);

  return NextResponse.json({
    success: true,
    sent,
    failed,
  });
}
