import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail, removeAttendeeFromEvent } from '@/lib/google';
import {
  processTemplate,
  createEmailVariables,
  defaultTemplates,
  htmlifyEmailBody,
} from '@/lib/email-templates';

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
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
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
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
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
    return NextResponse.json({ error: 'New slot not found' }, { status: 404 });
  }

  const bookingCount = newSlot.bookings?.[0]?.count || 0;
  if (bookingCount >= newSlot.event.max_attendees) {
    return NextResponse.json({ error: 'This time slot is full' }, { status: 400 });
  }

  // Update booking to new slot
  const { error: updateError } = await supabase
    .from('oh_bookings')
    .update({ slot_id: new_slot_id })
    .eq('id', booking.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to reschedule' }, { status: 500 });
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
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Cancel the booking
  const { error: updateError } = await supabase
    .from('oh_bookings')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', booking.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }

  // Get admin for Google API access
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('email', booking.slot.event.host_email)
    .single();

  if (admin?.google_access_token && admin?.google_refresh_token) {
    // Remove attendee from Google Calendar event
    if (booking.slot.google_event_id) {
      try {
        await removeAttendeeFromEvent(
          admin.google_access_token,
          admin.google_refresh_token,
          booking.slot.google_event_id,
          booking.email
        );
        console.log(`Removed ${booking.email} from calendar event ${booking.slot.google_event_id}`);
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

      const htmlBody = `
        <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
          <h2>Booking Cancelled</h2>
          <p>Hi ${booking.first_name},</p>
          <p>Your booking for <strong>${booking.slot.event.name}</strong> has been cancelled as requested.</p>
          <p>The calendar event has been removed from your calendar.</p>
          <p>If you'd like to book another time, please visit our booking page.</p>
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

  return NextResponse.json({ success: true });
}
