import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail, removeAttendeeFromEvent } from '@/lib/google';
import { CommonErrors } from '@/lib/errors';
import {
  processTemplate,
  createEmailVariables,
  defaultTemplates,
  htmlifyEmailBody,
} from '@/lib/email-templates';
import { updateMeetingOutcome } from '@/lib/hubspot';
import { calendarLogger } from '@/lib/logger';

// GET booking by manage token
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
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Get other available slots for rescheduling
  const { data: availableSlots } = await supabase
    .from('oh_slots')
    .select(`
      *,
      bookings:oh_bookings(count)
    `)
    .eq('event_id', booking.slot.event.id)
    .eq('is_cancelled', false)
    .gt('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  // Filter to slots that aren't full
  const openSlots = (availableSlots || []).filter((s: { bookings: { count: number }[]; }) => {
    const bookingCount = s.bookings?.[0]?.count || 0;
    return bookingCount < booking.slot.event.max_attendees;
  });

  return NextResponse.json({
    booking: {
      id: booking.id,
      first_name: booking.first_name,
      last_name: booking.last_name,
      email: booking.email,
      cancelled_at: booking.cancelled_at,
      question_responses: booking.question_responses,
    },
    slot: booking.slot,
    event: booking.slot.event,
    availableSlots: openSlots,
  });
}

// PUT reschedule booking
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { new_slot_id } = body;

  if (!new_slot_id) {
    return NextResponse.json({ error: 'new_slot_id is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Get current booking
  const { data: booking, error: bookingError } = await supabase
    .from('oh_bookings')
    .select(`
      *,
      slot:oh_slots(
        *,
        event:oh_events(*)
      ),
      assigned_host:oh_admins!assigned_host_id(id, name, email)
    `)
    .eq('manage_token', token)
    .is('cancelled_at', null)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Verify new slot exists and has capacity
  const { data: newSlot, error: slotError } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(count)
    `)
    .eq('id', new_slot_id)
    .eq('is_cancelled', false)
    .single();

  if (slotError || !newSlot) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  const bookingCount = newSlot.bookings?.[0]?.count || 0;
  if (bookingCount >= newSlot.event.max_attendees) {
    return NextResponse.json({ error: CommonErrors.SLOT_FULL }, { status: 400 });
  }

  // Update booking to new slot
  const { error: updateError } = await supabase
    .from('oh_bookings')
    .update({ slot_id: new_slot_id })
    .eq('id', booking.id);

  if (updateError) {
    return NextResponse.json({ error: CommonErrors.SERVER_ERROR }, { status: 500 });
  }

  // Send confirmation email for the reschedule
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('email', newSlot.event.host_email)
    .single();

  if (admin?.google_access_token && admin?.google_refresh_token) {
    try {
      // Get assigned host for round-robin bookings
      const assignedHost = booking.assigned_host as { id: string; name: string | null; email: string } | null;

      const variables = createEmailVariables(
        booking,
        { ...newSlot.event, meeting_type: newSlot.event.meeting_type },
        newSlot,
        booking.attendee_timezone || newSlot.event.display_timezone || 'America/New_York',
        undefined,
        assignedHost
      );

      const htmlBody = `
        <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
          <h2>Your booking has been rescheduled</h2>
          <p>Hi ${booking.first_name},</p>
          <p>Your ${newSlot.event.name} session has been rescheduled to:</p>
          <p><strong>${variables.date} at ${variables.time_with_timezone}</strong></p>
          ${newSlot.google_meet_link ? `
            <p>Join via Google Meet: <a href="${newSlot.google_meet_link}">${newSlot.google_meet_link}</a></p>
          ` : ''}
          <p>See you there!<br>${variables.host_name}</p>
        </div>
      `;

      await sendEmail(
        admin.google_access_token,
        admin.google_refresh_token,
        {
          to: booking.email,
          subject: `Rescheduled: ${newSlot.event.name}`,
          replyTo: newSlot.event.host_email,
          htmlBody,
        }
      );
    } catch (err) {
      console.error('Failed to send reschedule confirmation:', err);
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE cancel booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getServiceSupabase();

  // Parse cancellation reason from body
  let cancellationReason: string | null = null;
  try {
    const body = await request.json();
    cancellationReason = body.reason || null;
  } catch {
    // Body might be empty for older clients
  }

  // Get booking
  const { data: booking, error: bookingError } = await supabase
    .from('oh_bookings')
    .select(`
      *,
      slot:oh_slots(
        *,
        event:oh_events(*)
      ),
      assigned_host:oh_admins!assigned_host_id(id, name, email)
    `)
    .eq('manage_token', token)
    .is('cancelled_at', null)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  const wasWaitlisted = booking.is_waitlisted;

  // Cancel the booking with reason
  const { error: updateError } = await supabase
    .from('oh_bookings')
    .update({
      cancelled_at: new Date().toISOString(),
      cancellation_reason: cancellationReason,
    })
    .eq('id', booking.id);

  if (updateError) {
    return NextResponse.json({ error: CommonErrors.SERVER_ERROR }, { status: 500 });
  }

  // Get admin for Google API access
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('email', booking.slot.event.host_email)
    .single();

  if (admin?.google_access_token && admin?.google_refresh_token) {
    // Remove attendee from Google Calendar event (only if they were confirmed, not waitlisted)
    if (booking.slot.google_event_id && !wasWaitlisted) {
      try {
        await removeAttendeeFromEvent(
          admin.google_access_token,
          admin.google_refresh_token,
          booking.slot.google_event_id,
          booking.email
        );
        calendarLogger.info('Removed attendee from calendar event', {
          operation: 'cancellation',
          bookingId: booking.id,
          attendeeEmail: booking.email,
          metadata: { googleEventId: booking.slot.google_event_id },
        });
      } catch (err) {
        console.error('Failed to remove attendee from calendar event:', err);
        // Continue with cancellation even if calendar update fails
      }
    }

    // Send cancellation confirmation email
    try {
      // Get assigned host name for round-robin bookings
      const assignedHost = booking.assigned_host as { id: string; name: string | null; email: string } | null;
      const hostName = booking.slot.event.meeting_type === 'round_robin' && assignedHost
        ? (assignedHost.name || assignedHost.email.split('@')[0])
        : booking.slot.event.host_name;

      const bookingLink = `${process.env.NEXT_PUBLIC_APP_URL}/book/${booking.slot.event.slug}`;
      const htmlBody = `
        <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
          <h2>${wasWaitlisted ? 'Waitlist Spot Removed' : 'Booking Cancelled'}</h2>
          <p>Hi ${booking.first_name},</p>
          <p>Your ${wasWaitlisted ? 'waitlist spot' : 'booking'} for <strong>${booking.slot.event.name}</strong> has been cancelled as requested.</p>
          ${!wasWaitlisted ? '<p>The calendar event has been removed from your calendar.</p>' : ''}
          <p>If you'd like to book another time, I'd love to still connect with you:</p>
          <p><a href="${bookingLink}" style="color: #6F71EE; text-decoration: none;">${bookingLink}</a></p>
          <p>Best,<br>${hostName}</p>
        </div>
      `;

      await sendEmail(
        admin.google_access_token,
        admin.google_refresh_token,
        {
          to: booking.email,
          subject: `Cancelled: ${booking.slot.event.name}`,
          replyTo: booking.slot.event.host_email,
          htmlBody,
        }
      );
    } catch (err) {
      console.error('Failed to send cancellation confirmation:', err);
    }
  }

  // Sync cancellation to HubSpot
  if (booking.hubspot_contact_id) {
    try {
      const notes = cancellationReason
        ? `Cancelled by attendee. Reason: ${cancellationReason}`
        : 'Cancelled by attendee';
      await updateMeetingOutcome(
        booking.hubspot_contact_id,
        booking.slot.event.name,
        'CANCELED',
        notes
      );
    } catch (err) {
      console.error('Failed to sync cancellation to HubSpot:', err);
    }
  }

  // If the cancelled booking was confirmed (not waitlisted), promote from waitlist
  if (!wasWaitlisted && booking.slot.event.waitlist_enabled) {
    await promoteFromWaitlist(booking.slot_id, booking.slot, admin, supabase);
  }

  // If cancelled booking was waitlisted, update positions for remaining waitlist
  if (wasWaitlisted) {
    await updateWaitlistPositions(booking.slot_id, supabase);
  }

  return NextResponse.json({ success: true });
}

// Helper to promote the first person from the waitlist
async function promoteFromWaitlist(
  slotId: string,
  slot: { google_event_id: string | null; google_meet_link: string | null; start_time: string; end_time: string; event: { id: string; name: string; host_email: string; host_name: string; description: string | null } },
  admin: { google_access_token: string | null; google_refresh_token: string | null } | null,
  supabase: ReturnType<typeof getServiceSupabase>
) {
  // Get the first waitlisted booking
  const { data: nextInLine, error } = await supabase
    .from('oh_bookings')
    .select('*')
    .eq('slot_id', slotId)
    .is('cancelled_at', null)
    .eq('is_waitlisted', true)
    .order('waitlist_position', { ascending: true })
    .limit(1)
    .single();

  if (error || !nextInLine) {
    // No one on waitlist
    return;
  }

  // Promote them
  const { error: promoteError } = await supabase
    .from('oh_bookings')
    .update({
      is_waitlisted: false,
      waitlist_position: null,
      promoted_from_waitlist_at: new Date().toISOString(),
    })
    .eq('id', nextInLine.id);

  if (promoteError) {
    console.error('Failed to promote from waitlist:', promoteError);
    return;
  }

  // Add to Google Calendar
  if (admin?.google_access_token && admin?.google_refresh_token && slot.google_event_id) {
    const { addAttendeeToEvent } = await import('@/lib/google');
    try {
      await addAttendeeToEvent(
        admin.google_access_token,
        admin.google_refresh_token,
        slot.google_event_id,
        nextInLine.email
      );
    } catch (err) {
      console.error('Failed to add promoted attendee to calendar:', err);
    }
  }

  // Send promotion notification email
  if (admin?.google_access_token && admin?.google_refresh_token) {
    try {
      const { format, parseISO } = await import('date-fns');
      const { formatInTimeZone } = await import('date-fns-tz');
      const timezone = nextInLine.attendee_timezone || 'America/New_York';
      const sessionTime = formatInTimeZone(parseISO(slot.start_time), timezone, "EEEE, MMMM d 'at' h:mm a zzz");
      const manageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/manage/${nextInLine.manage_token}`;

      const htmlBody = `
        <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
          <div style="background: #DCFCE7; border-left: 4px solid #22C55E; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <h2 style="margin: 0 0 8px 0; color: #166534; font-size: 18px;">Great news! You're off the waitlist!</h2>
            <p style="margin: 0; color: #166534; font-size: 14px;">
              A spot opened up and your booking is now confirmed.
            </p>
          </div>

          <p style="color: #667085; font-size: 16px; margin-bottom: 20px;">
            Hi ${nextInLine.first_name},
          </p>

          <p style="color: #667085; font-size: 16px; margin-bottom: 20px;">
            A spot has become available for <strong>${slot.event.name}</strong> and you've been moved from the waitlist to a confirmed booking!
          </p>

          <p style="color: #667085; font-size: 16px; margin-bottom: 20px;">
            <strong>When:</strong> ${sessionTime}
          </p>

          ${slot.google_meet_link ? `
            <div style="background: #6F71EE; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <a href="${slot.google_meet_link}" style="color: white; text-decoration: none; font-weight: 600;">
                Join Google Meet →
              </a>
            </div>
          ` : ''}

          <p style="color: #667085; font-size: 14px; margin-bottom: 20px;">
            A calendar invite has been sent to your email. Please add this session to your calendar.
          </p>

          <div style="background: #F6F6F9; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="color: #667085; margin: 0 0 12px 0; font-size: 14px;">
              Can't make it anymore? Let us know so someone else can take your spot.
            </p>
            <a href="${manageUrl}" style="display: inline-block; background: #6F71EE; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Manage Booking
            </a>
          </div>

          <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; margin-top: 20px; text-align: center;">
            <p style="color: #98A2B3; font-size: 12px; margin: 0;">
              Sent from Connect with LiveSchool
            </p>
          </div>
        </div>
      `;

      await sendEmail(
        admin.google_access_token,
        admin.google_refresh_token,
        {
          to: nextInLine.email,
          subject: `You're confirmed! ${slot.event.name}`,
          replyTo: slot.event.host_email,
          htmlBody,
        }
      );

      // Mark notification sent
      await supabase
        .from('oh_bookings')
        .update({ waitlist_notification_sent_at: new Date().toISOString() })
        .eq('id', nextInLine.id);
    } catch (err) {
      console.error('Failed to send waitlist promotion email:', err);
    }
  }

  // Update positions for remaining waitlisted bookings
  await updateWaitlistPositions(slotId, supabase);
}

// Helper to update waitlist positions after a promotion or cancellation
async function updateWaitlistPositions(
  slotId: string,
  supabase: ReturnType<typeof getServiceSupabase>
) {
  // Get all remaining waitlisted bookings ordered by current position
  const { data: waitlisted } = await supabase
    .from('oh_bookings')
    .select('id, waitlist_position')
    .eq('slot_id', slotId)
    .is('cancelled_at', null)
    .eq('is_waitlisted', true)
    .order('waitlist_position', { ascending: true });

  if (!waitlisted || waitlisted.length === 0) return;

  // Update each position sequentially
  for (let i = 0; i < waitlisted.length; i++) {
    const newPosition = i + 1;
    if (waitlisted[i].waitlist_position !== newPosition) {
      await supabase
        .from('oh_bookings')
        .update({ waitlist_position: newPosition })
        .eq('id', waitlisted[i].id);
    }
  }
}
