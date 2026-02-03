import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/google';
import { updateMeetingOutcome } from '@/lib/hubspot';
import { getUserFriendlyError, CommonErrors } from '@/lib/errors';
import { escapeHtml } from '@/lib/email-html';

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
      slot:oh_slots!slot_id(
        *,
        event:oh_events!event_id(*)
      )
    `)
    .eq('id', id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Verify the requesting admin hosts this booking's event
  const patchSlotData = booking.slot as { event_id?: string } | null;
  const patchEventId = patchSlotData?.event_id;

  if (patchEventId) {
    const { data: patchAdmin } = await supabase
      .from('oh_admins')
      .select('id')
      .eq('email', session.email)
      .single();

    const { data: patchPrimaryEvent } = await supabase
      .from('oh_events')
      .select('id')
      .eq('id', patchEventId)
      .eq('host_email', session.email)
      .single();

    let patchIsCoHost = false;
    if (!patchPrimaryEvent && patchAdmin) {
      const { data: coHostEntry } = await supabase
        .from('oh_event_hosts')
        .select('id')
        .eq('event_id', patchEventId)
        .eq('admin_id', patchAdmin.id)
        .single();
      patchIsCoHost = !!coHostEntry;
    }

    if (!patchPrimaryEvent && !patchIsCoHost) {
      return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
    }
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
          const manageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/manage/${booking.manage_token}`;

          const htmlBody = `
            <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
              <h2>We missed you!</h2>
              <p>Hi ${escapeHtml(booking.first_name)},</p>
              <p>We noticed you weren't able to make it to <strong>${escapeHtml(booking.slot.event.name)}</strong> today.</p>
              <p>No worries! Life happens. If you'd like to reschedule for another time, you can do so here:</p>
              <div style="margin: 20px 0;">
                <a href="${manageUrl}" style="background: #6F71EE; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Reschedule Your Session
                </a>
              </div>
              <p>We hope to see you soon!</p>
              <p>Best,<br>${escapeHtml(booking.slot.event.host_name)}</p>
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
    const rating = Number(body.feedback_rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
    }
    if (body.feedback_comment && typeof body.feedback_comment === 'string' && body.feedback_comment.length > 5000) {
      return NextResponse.json({ error: 'Feedback comment must be 5,000 characters or less' }, { status: 400 });
    }
    updates.feedback_rating = rating;
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

// GET single booking (admin only, scoped to hosted events)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: CommonErrors.UNAUTHORIZED }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  const { data: booking, error } = await supabase
    .from('oh_bookings')
    .select(`
      *,
      slot:oh_slots!slot_id(
        *,
        event:oh_events!event_id(*)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Verify the requesting admin hosts this booking's event
  const slotData = booking.slot as { event_id?: string; event?: { host_email?: string } } | null;
  const eventId = slotData?.event_id;

  if (eventId) {
    const { data: admin } = await supabase
      .from('oh_admins')
      .select('id')
      .eq('email', session.email)
      .single();

    const { data: primaryEvent } = await supabase
      .from('oh_events')
      .select('id')
      .eq('id', eventId)
      .eq('host_email', session.email)
      .single();

    let isCoHost = false;
    if (!primaryEvent && admin) {
      const { data: coHostEntry } = await supabase
        .from('oh_event_hosts')
        .select('id')
        .eq('event_id', eventId)
        .eq('admin_id', admin.id)
        .single();
      isCoHost = !!coHostEntry;
    }

    if (!primaryEvent && !isCoHost) {
      return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
    }
  }

  return NextResponse.json(booking);
}
