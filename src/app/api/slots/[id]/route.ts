import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/google';
import {
  processTemplate,
  createEmailVariables,
  defaultTemplates,
  htmlifyEmailBody,
} from '@/lib/email-templates';

// PATCH slot (admin only) - update recording link, etc.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = getServiceSupabase();

  // Only allow updating certain fields
  const allowedUpdates: Record<string, unknown> = {};
  if (body.recording_link !== undefined) {
    allowedUpdates.recording_link = body.recording_link || null;
  }

  if (Object.keys(allowedUpdates).length === 0) {
    return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
  }

  const { data: slot, error } = await supabase
    .from('oh_slots')
    .update(allowedUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(slot);
}

// DELETE slot (admin only) - sends cancellation notifications to all attendees
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  // Get the slot with event and bookings before cancelling
  const { data: slot, error: slotError } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(*,
        assigned_host:oh_admins!assigned_host_id(id, name, email)
      )
    `)
    .eq('id', id)
    .single();

  if (slotError || !slot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }

  // Mark as cancelled
  const { error } = await supabase
    .from('oh_slots')
    .update({ is_cancelled: true })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send cancellation notifications to all attendees
  const activeBookings = (slot.bookings || []).filter(
    (b: { cancelled_at: string | null }) => !b.cancelled_at
  );

  if (activeBookings.length > 0) {
    // Get admin tokens
    const { data: admin } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', slot.event.host_email)
      .single();

    if (admin?.google_access_token && admin?.google_refresh_token) {
      const cancellationResults = await Promise.allSettled(
        activeBookings.map(async (booking: { first_name: string; last_name: string; email: string; id: string; attendee_timezone?: string; assigned_host?: { id: string; name: string | null; email: string } | null }) => {
          const assignedHost = booking.assigned_host || null;
          const variables = createEmailVariables(
            booking,
            { ...slot.event, meeting_type: slot.event.meeting_type },
            slot,
            booking.attendee_timezone || slot.event.display_timezone || 'America/New_York',
            undefined,
            assignedHost
          );

          const subject = processTemplate(
            slot.event.cancellation_subject || defaultTemplates.cancellation_subject,
            variables
          );

          const bodyText = processTemplate(
            slot.event.cancellation_body || defaultTemplates.cancellation_body,
            variables
          );

          const htmlBody = `
            <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
              ${htmlifyEmailBody(bodyText)}
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

          // Mark booking as cancelled
          await supabase
            .from('oh_bookings')
            .update({ cancelled_at: new Date().toISOString() })
            .eq('id', booking.id);

          return booking.email;
        })
      );

      const notified = cancellationResults.filter((r) => r.status === 'fulfilled').length;
      const failed = cancellationResults.filter((r) => r.status === 'rejected').length;

      console.log(`Slot ${id} cancelled. Notified: ${notified}, Failed: ${failed}`);
    }
  }

  return NextResponse.json({
    success: true,
    attendeesNotified: activeBookings.length,
  });
}
