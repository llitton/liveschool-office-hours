import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/google';
import { updateMeetingOutcome } from '@/lib/hubspot';
import { getUserFriendlyError, CommonErrors } from '@/lib/errors';

// PATCH update booking (attendance status, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: CommonErrors.UNAUTHORIZED }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = getServiceSupabase();

  // Get current booking with slot and event info
  const { data: booking, error: bookingError } = await supabase
    .from('oh_bookings')
    .select(`
      *,
      slot:oh_slots(
        *,
        event:oh_events(*)
      )
    `)
    .eq('id', id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Build update object
  const updates: Record<string, unknown> = {};

  // Handle attendance marking
  if (body.status === 'attended') {
    updates.attended_at = new Date().toISOString();
    updates.no_show_at = null;
  } else if (body.status === 'no_show') {
    updates.no_show_at = new Date().toISOString();
    updates.attended_at = null;

    // Send "we missed you" email if requested
    if (body.send_no_show_email) {
      const { data: admin } = await supabase
        .from('oh_admins')
        .select('*')
        .eq('email', booking.slot.event.host_email)
        .single();

      if (admin?.google_access_token && admin?.google_refresh_token) {
        try {
          const manageUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://liveschoolhelp.com'}/manage/${booking.manage_token}`;

          const htmlBody = `
            <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
              <h2>We missed you!</h2>
              <p>Hi ${booking.first_name},</p>
              <p>We noticed you weren't able to make it to <strong>${booking.slot.event.name}</strong> today.</p>
              <p>No worries! Life happens. If you'd like to reschedule for another time, you can do so here:</p>
              <div style="margin: 20px 0;">
                <a href="${manageUrl}" style="background: #6F71EE; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Reschedule Your Session
                </a>
              </div>
              <p>We hope to see you soon!</p>
              <p>Best,<br>${booking.slot.event.host_name}</p>
            </div>
          `;

          await sendEmail(
            admin.google_access_token,
            admin.google_refresh_token,
            {
              to: booking.email,
              subject: `We missed you at ${booking.slot.event.name}`,
              replyTo: booking.slot.event.host_email,
              htmlBody,
            }
          );

          updates.no_show_email_sent_at = new Date().toISOString();
        } catch (err) {
          console.error('Failed to send no-show email:', err);
        }
      }
    }
  } else if (body.status === 'clear') {
    updates.attended_at = null;
    updates.no_show_at = null;
  }

  // Handle feedback submission
  if (body.feedback_rating !== undefined) {
    updates.feedback_rating = body.feedback_rating;
    updates.feedback_comment = body.feedback_comment || null;
    updates.feedback_submitted_at = new Date().toISOString();
  }

  // Update booking
  const { data: updated, error: updateError } = await supabase
    .from('oh_bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: getUserFriendlyError(updateError) }, { status: 500 });
  }

  // Sync attendance outcome to HubSpot
  let hubspotSynced = false;
  if ((body.status === 'attended' || body.status === 'no_show') && booking.hubspot_contact_id) {
    const hubspotOutcome = body.status === 'attended' ? 'COMPLETED' : 'NO_SHOW';
    try {
      hubspotSynced = await updateMeetingOutcome(
        booking.hubspot_contact_id,
        booking.slot.event.name,
        hubspotOutcome
      );
    } catch (err) {
      console.error('Failed to sync HubSpot outcome:', err);
    }
  }

  return NextResponse.json({
    ...updated,
    hubspot_synced: hubspotSynced,
    hubspot_contact_exists: !!booking.hubspot_contact_id,
  });
}

// GET single booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceSupabase();

  const { data: booking, error } = await supabase
    .from('oh_bookings')
    .select(`
      *,
      slot:oh_slots(
        *,
        event:oh_events(*)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  return NextResponse.json(booking);
}
