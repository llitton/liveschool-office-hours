import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { addAttendeeToEvent, sendEmail } from '@/lib/google';
import { format } from 'date-fns';

// POST create booking (public)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slot_id, first_name, last_name, email } = body;

  if (!slot_id || !first_name || !last_name || !email) {
    return NextResponse.json(
      { error: 'slot_id, first_name, last_name, and email are required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get the slot with event and booking count
  const { data: slot, error: slotError } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(count)
    `)
    .eq('id', slot_id)
    .single();

  if (slotError || !slot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }

  if (slot.is_cancelled) {
    return NextResponse.json(
      { error: 'This time slot is no longer available' },
      { status: 400 }
    );
  }

  // Check if slot is full
  const bookingCount = slot.bookings?.[0]?.count || 0;
  if (bookingCount >= slot.event.max_attendees) {
    return NextResponse.json(
      { error: 'This time slot is full' },
      { status: 400 }
    );
  }

  // Check if user already booked this slot
  const { data: existingBooking } = await supabase
    .from('oh_bookings')
    .select('id')
    .eq('slot_id', slot_id)
    .eq('email', email.toLowerCase())
    .is('cancelled_at', null)
    .single();

  if (existingBooking) {
    return NextResponse.json(
      { error: 'You have already booked this time slot' },
      { status: 400 }
    );
  }

  // Create the booking
  const { data: booking, error: bookingError } = await supabase
    .from('oh_bookings')
    .insert({
      slot_id,
      first_name,
      last_name,
      email: email.toLowerCase(),
    })
    .select()
    .single();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  // Get admin with tokens to send emails and add to calendar
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('email', slot.event.host_email)
    .single();

  if (admin?.google_access_token && admin?.google_refresh_token) {
    // Add to calendar event if it exists
    if (slot.google_event_id) {
      try {
        await addAttendeeToEvent(
          admin.google_access_token,
          admin.google_refresh_token,
          slot.google_event_id,
          email.toLowerCase()
        );

        await supabase
          .from('oh_bookings')
          .update({ calendar_invite_sent_at: new Date().toISOString() })
          .eq('id', booking.id);
      } catch (err) {
        console.error('Failed to add attendee to calendar:', err);
      }
    }

    // Send confirmation email
    try {
      const eventDate = new Date(slot.start_time);
      const formattedDate = format(eventDate, 'EEEE, MMMM d, yyyy');
      const formattedTime = format(eventDate, 'h:mm a');

      await sendEmail(
        admin.google_access_token,
        admin.google_refresh_token,
        {
          to: email,
          subject: `Confirmed: ${slot.event.name} with ${slot.event.host_name} on ${formattedDate}`,
          replyTo: slot.event.host_email,
          htmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Hi ${first_name} ${last_name},</h2>

              <p style="font-size: 16px; color: #333;">
                Your <strong>${slot.event.name}</strong> with ${slot.event.host_name} at
                <strong>${formattedTime}</strong> on <strong>${formattedDate}</strong> is scheduled.
              </p>

              ${slot.event.description ? `
                <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #333;">About this session:</h3>
                  <p style="color: #555;">${slot.event.description}</p>
                </div>
              ` : ''}

              <div style="background: #e8f4f8; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #333;">Location:</h3>
                <p style="color: #555;">
                  ${slot.google_meet_link
                    ? `<a href="${slot.google_meet_link}" style="color: #1a73e8;">Join Google Meet</a>`
                    : 'Google Meet (link will be provided in calendar invite)'}
                </p>
              </div>

              <p style="font-size: 14px; color: #666;">
                A calendar invitation has been sent to your email. If you need to cancel or reschedule,
                please reply to this email.
              </p>

              <p style="font-size: 14px; color: #666;">
                See you there!<br>
                ${slot.event.host_name}
              </p>
            </div>
          `,
        }
      );

      await supabase
        .from('oh_bookings')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', booking.id);
    } catch (err) {
      console.error('Failed to send confirmation email:', err);
    }
  }

  return NextResponse.json({
    ...booking,
    event: slot.event,
    slot: {
      start_time: slot.start_time,
      end_time: slot.end_time,
      google_meet_link: slot.google_meet_link,
    },
  });
}

// GET bookings for a slot (admin only via query param check)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const slotId = searchParams.get('slotId');

  if (!slotId) {
    return NextResponse.json({ error: 'slotId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data: bookings, error } = await supabase
    .from('oh_bookings')
    .select('*')
    .eq('slot_id', slotId)
    .is('cancelled_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(bookings);
}
