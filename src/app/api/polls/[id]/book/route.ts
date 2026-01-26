import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { createCalendarEvent, sendEmail } from '@/lib/google';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { nanoid } from 'nanoid';

// POST book the meeting for the selected option
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pollId } = await params;

  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    option_id, // The winning time slot
    additional_invitees = [], // Array of { name, email } for people who didn't vote
  } = body;

  if (!option_id) {
    return NextResponse.json({ error: 'Option ID is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Get admin with Google tokens
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  // Get poll with option and voters
  const { data: poll, error: pollError } = await supabase
    .from('oh_polls')
    .select(`
      *,
      options:oh_poll_options(
        id,
        start_time,
        end_time,
        votes:oh_poll_votes(voter_name, voter_email)
      )
    `)
    .eq('id', pollId)
    .eq('host_id', admin.id)
    .single();

  if (pollError || !poll) {
    return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
  }

  if (poll.status === 'booked') {
    return NextResponse.json({ error: 'Poll is already booked' }, { status: 400 });
  }

  // Find the selected option
  const selectedOption = poll.options?.find((opt: { id: string }) => opt.id === option_id);
  if (!selectedOption) {
    return NextResponse.json({ error: 'Invalid option ID' }, { status: 400 });
  }

  // Collect all attendees (voters + additional invitees)
  const attendees: { name: string; email: string }[] = [];
  const seenEmails = new Set<string>();

  // Add voters for the selected option
  selectedOption.votes?.forEach((vote: { voter_name: string; voter_email: string }) => {
    if (!seenEmails.has(vote.voter_email.toLowerCase())) {
      attendees.push({ name: vote.voter_name, email: vote.voter_email });
      seenEmails.add(vote.voter_email.toLowerCase());
    }
  });

  // Add additional invitees
  additional_invitees.forEach((invitee: { name: string; email: string }) => {
    if (!seenEmails.has(invitee.email.toLowerCase())) {
      attendees.push(invitee);
      seenEmails.add(invitee.email.toLowerCase());
    }
  });

  // Store additional invitees in the database
  if (additional_invitees.length > 0) {
    const inviteesToInsert = additional_invitees.map((inv: { name: string; email: string }) => ({
      poll_id: pollId,
      name: inv.name,
      email: inv.email.toLowerCase(),
    }));

    await supabase.from('oh_poll_invitees').upsert(inviteesToInsert, {
      onConflict: 'poll_id,email',
    });
  }

  // Create a one-off event for this poll
  const eventSlug = `poll-meeting-${nanoid(10)}`;

  const { data: event, error: eventError } = await supabase
    .from('oh_events')
    .insert({
      slug: eventSlug,
      name: poll.title,
      description: poll.description || null,
      duration_minutes: poll.duration_minutes,
      host_name: admin.name || admin.email.split('@')[0],
      host_email: admin.email,
      host_id: admin.id,
      max_attendees: attendees.length + 1,
      is_active: false, // Not publicly bookable
      meeting_type: 'group',
      is_one_off: true,
      single_use: true,
      one_off_booked_at: new Date().toISOString(),
      min_notice_hours: 0,
      booking_window_days: 365,
    })
    .select()
    .single();

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  // Create calendar event with Google Meet
  let googleEventId: string | null = null;
  let googleMeetLink: string | null = null;

  if (admin.google_access_token && admin.google_refresh_token) {
    try {
      const attendeeEmails = attendees.map((a) => a.email);

      const calendarResult = await createCalendarEvent(
        admin.google_access_token,
        admin.google_refresh_token,
        {
          summary: poll.title,
          description: poll.description || `Meeting from poll: ${poll.title}`,
          startTime: selectedOption.start_time,
          endTime: selectedOption.end_time,
          hostEmail: admin.email,
          coHostEmails: attendeeEmails, // Use coHostEmails to add all attendees
        }
      );

      googleEventId = calendarResult.eventId || null;
      googleMeetLink = calendarResult.meetLink;
    } catch (err) {
      console.error('Failed to create calendar event:', err);
    }
  }

  // Create the slot
  const { data: slot, error: slotError } = await supabase
    .from('oh_slots')
    .insert({
      event_id: event.id,
      start_time: selectedOption.start_time,
      end_time: selectedOption.end_time,
      google_event_id: googleEventId,
      google_meet_link: googleMeetLink,
    })
    .select()
    .single();

  if (slotError) {
    return NextResponse.json({ error: slotError.message }, { status: 500 });
  }

  // Update poll status
  const { error: updateError } = await supabase
    .from('oh_polls')
    .update({
      status: 'booked',
      booked_at: new Date().toISOString(),
      booked_option_id: option_id,
      booked_event_id: event.id,
      booked_slot_id: slot.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pollId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Send confirmation emails to all attendees
  if (admin.google_access_token && admin.google_refresh_token) {
    // Get host's timezone from their availability patterns
    const { data: tzPattern } = await supabase
      .from('oh_availability_patterns')
      .select('timezone')
      .eq('admin_id', admin.id)
      .limit(1)
      .single();
    const timezone = tzPattern?.timezone || 'America/New_York';

    for (const attendee of attendees) {
      try {
        const htmlBody = `
          <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
            <div style="background: #417762; padding: 24px; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Meeting Scheduled!</h1>
            </div>

            <div style="padding: 24px; background: #F6F6F9;">
              <p style="color: #667085; font-size: 16px; margin-bottom: 20px;">
                Hi ${attendee.name},
              </p>

              <p style="color: #667085; font-size: 16px; margin-bottom: 20px;">
                The poll results are in and <strong>${poll.title}</strong> has been scheduled!
              </p>

              <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h2 style="color: #101E57; margin-top: 0; font-size: 18px;">${poll.title}</h2>
                <p style="color: #667085; margin: 8px 0;">
                  <strong>Date:</strong> ${formatInTimeZone(parseISO(selectedOption.start_time), timezone, 'EEEE, MMMM d, yyyy')}
                </p>
                <p style="color: #667085; margin: 8px 0;">
                  <strong>Time:</strong> ${formatInTimeZone(parseISO(selectedOption.start_time), timezone, 'h:mm a')} - ${formatInTimeZone(parseISO(selectedOption.end_time), timezone, 'h:mm a')}
                </p>
                <p style="color: #667085; margin: 8px 0;">
                  <strong>Duration:</strong> ${poll.duration_minutes} minutes
                </p>
                ${googleMeetLink ? `
                  <p style="color: #667085; margin: 8px 0;">
                    <strong>Location:</strong> <a href="${googleMeetLink}" style="color: #6F71EE;">Google Meet</a>
                  </p>
                ` : ''}
              </div>

              ${googleMeetLink ? `
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${googleMeetLink}" style="display: inline-block; background: #6F71EE; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    Join Google Meet
                  </a>
                </div>
              ` : ''}

              <p style="color: #667085; font-size: 14px; margin-top: 20px;">
                A calendar invite has been sent to your email.
              </p>
            </div>

            <div style="text-align: center; padding: 16px; border-top: 1px solid #E5E7EB;">
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
            to: attendee.email,
            subject: `Meeting Scheduled: ${poll.title}`,
            replyTo: admin.email,
            htmlBody,
          }
        );
      } catch (err) {
        console.error(`Failed to send email to ${attendee.email}:`, err);
      }
    }
  }

  return NextResponse.json({
    success: true,
    event_id: event.id,
    slot_id: slot.id,
    google_meet_link: googleMeetLink,
    attendees_notified: attendees.length,
  });
}
