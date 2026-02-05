import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { sendEmail, deleteCalendarEvent } from '@/lib/google';
import { getUserFriendlyError, CommonErrors, safeParseJSON } from '@/lib/errors';
import {
  processTemplate,
  createEmailVariables,
  defaultTemplates,
  htmlifyEmailBody,
} from '@/lib/email-templates';
import { slotLogger } from '@/lib/logger';

// Helper: verify the requesting admin hosts or co-hosts the event for this slot
async function verifySlotAccess(supabase: ReturnType<typeof getServiceSupabase>, slotId: string, sessionEmail: string): Promise<boolean> {
  const { data: slot } = await supabase
    .from('oh_slots')
    .select('event_id')
    .eq('id', slotId)
    .single();

  if (!slot) return false;

  // Check if primary host
  const { data: primaryEvent } = await supabase
    .from('oh_events')
    .select('id')
    .eq('id', slot.event_id)
    .eq('host_email', sessionEmail)
    .single();

  if (primaryEvent) return true;

  // Check if co-host
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', sessionEmail)
    .single();

  if (admin) {
    const { data: coHostEntry } = await supabase
      .from('oh_event_hosts')
      .select('id')
      .eq('event_id', slot.event_id)
      .eq('admin_id', admin.id)
      .single();

    if (coHostEntry) return true;
  }

  return false;
}

// PATCH slot (admin only) - update recording link, etc.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: CommonErrors.UNAUTHORIZED }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  // Verify the requesting admin hosts or co-hosts this slot's event
  const hasAccess = await verifySlotAccess(supabase, id, session.email);
  if (!hasAccess) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  const body = await safeParseJSON<Record<string, any>>(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Only allow updating certain fields
  const allowedUpdates: Record<string, unknown> = {};
  if (body.recording_link !== undefined) {
    if (body.recording_link && typeof body.recording_link === 'string' && body.recording_link.length > 2048) {
      return NextResponse.json({ error: 'Recording link must be 2,048 characters or less' }, { status: 400 });
    }
    allowedUpdates.recording_link = body.recording_link || null;
  }
  if (body.deck_link !== undefined) {
    if (body.deck_link && typeof body.deck_link === 'string' && body.deck_link.length > 2048) {
      return NextResponse.json({ error: 'Deck link must be 2,048 characters or less' }, { status: 400 });
    }
    allowedUpdates.deck_link = body.deck_link || null;
  }
  if (body.shared_links !== undefined) {
    // Validate shared_links format: array of {title, url} objects
    if (Array.isArray(body.shared_links)) {
      if (body.shared_links.length > 20) {
        return NextResponse.json({ error: 'Maximum 20 shared links allowed' }, { status: 400 });
      }
      allowedUpdates.shared_links = body.shared_links.filter(
        (link: { title?: string; url?: string }) =>
          link.title && typeof link.title === 'string' && link.title.length <= 200 &&
          link.url && typeof link.url === 'string' && link.url.length <= 2048
      );
    } else {
      allowedUpdates.shared_links = [];
    }
  }
  if (body.skip_automated_emails !== undefined) {
    allowedUpdates.skip_automated_emails = Boolean(body.skip_automated_emails);
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
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
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
    return NextResponse.json({ error: CommonErrors.UNAUTHORIZED }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  // Get the slot with event and bookings before cancelling
  const { data: slot, error: slotError } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events!event_id(*),
      bookings:oh_bookings!slot_id(*,
        assigned_host:oh_admins!assigned_host_id(id, name, email)
      )
    `)
    .eq('id', id)
    .single();

  if (slotError || !slot) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Verify the requesting admin hosts or co-hosts this slot's event
  const hasDeleteAccess = await verifySlotAccess(supabase, id, session.email);
  if (!hasDeleteAccess) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  const permanent = request.nextUrl.searchParams.get('permanent') === 'true';

  if (permanent) {
    // Permanently delete all bookings for this slot first (cascade)
    const { error: bookingsDeleteError } = await supabase
      .from('oh_bookings')
      .delete()
      .eq('slot_id', id);

    if (bookingsDeleteError) {
      console.error('[Slot/Delete] Failed to delete bookings:', bookingsDeleteError);
      return NextResponse.json({ error: getUserFriendlyError(bookingsDeleteError) }, { status: 500 });
    }

    // Delete the Google Calendar event if one exists
    if (slot.google_event_id) {
      const { data: admin } = await supabase
        .from('oh_admins')
        .select('google_access_token, google_refresh_token')
        .eq('email', slot.event.host_email)
        .single();

      if (admin?.google_access_token && admin?.google_refresh_token) {
        try {
          await deleteCalendarEvent(
            admin.google_access_token,
            admin.google_refresh_token,
            slot.google_event_id
          );
        } catch (err) {
          console.error('[Slot/Delete] Failed to delete calendar event:', err);
          // Continue with slot deletion even if calendar fails
        }
      }
    }

    // Permanently delete the slot
    const { error: slotDeleteError } = await supabase
      .from('oh_slots')
      .delete()
      .eq('id', id);

    if (slotDeleteError) {
      console.error('[Slot/Delete] Failed to delete slot:', slotDeleteError);
      return NextResponse.json({ error: getUserFriendlyError(slotDeleteError) }, { status: 500 });
    }

    slotLogger.info('Slot permanently deleted', {
      operation: 'permanentDeleteSlot',
      slotId: id,
      metadata: { deletedBy: session.email, bookingsDeleted: (slot.bookings || []).length, calendarDeleted: !!slot.google_event_id },
    });

    return NextResponse.json({ success: true, permanent: true });
  }

  // Soft cancel: mark as cancelled and notify attendees
  const { error } = await supabase
    .from('oh_slots')
    .update({ is_cancelled: true })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
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

      slotLogger.info('Slot cancelled with attendee notifications', {
        operation: 'cancelSlot',
        slotId: id,
        metadata: { notified, failed },
      });
    }
  }

  return NextResponse.json({
    success: true,
    attendeesNotified: activeBookings.length,
  });
}
