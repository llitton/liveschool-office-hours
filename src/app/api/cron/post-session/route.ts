import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/google';

// This cron job runs hourly to handle post-session tasks:
// 1. Send feedback requests 1 hour after session ends
// 2. Send recording links when added

export async function GET() {
  const supabase = getServiceSupabase();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  let feedbackSent = 0;
  let recordingsSent = 0;

  // Get slots that ended 1-2 hours ago (for feedback requests)
  const { data: recentSlots } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(*)
    `)
    .eq('is_cancelled', false)
    .lt('end_time', oneHourAgo.toISOString())
    .gt('end_time', twoHoursAgo.toISOString());

  for (const slot of recentSlots || []) {
    // Get admin tokens
    const { data: admin } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', slot.event.host_email)
      .single();

    if (!admin?.google_access_token || !admin?.google_refresh_token) continue;

    // Send feedback requests to attendees who haven't received one
    for (const booking of slot.bookings || []) {
      if (booking.cancelled_at) continue;
      if (booking.feedback_sent_at) continue;
      if (!booking.manage_token) continue;

      // Only send to attended or unmarked bookings (not no-shows)
      if (booking.no_show_at) continue;

      try {
        const feedbackUrl = `${process.env.APP_URL || 'http://localhost:3000'}/feedback/${booking.manage_token}`;

        const htmlBody = `
          <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
            <h2>How was your session?</h2>
            <p>Hi ${booking.first_name},</p>
            <p>Thanks for attending <strong>${slot.event.name}</strong>! We'd love to hear your feedback.</p>
            <div style="margin: 24px 0;">
              <a href="${feedbackUrl}" style="background: #6F71EE; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Share Your Feedback
              </a>
            </div>
            <p>Your input helps us improve future sessions!</p>
            <p>Best,<br>${slot.event.host_name}</p>
          </div>
        `;

        await sendEmail(
          admin.google_access_token,
          admin.google_refresh_token,
          {
            to: booking.email,
            subject: `How was ${slot.event.name}?`,
            replyTo: slot.event.host_email,
            htmlBody,
          }
        );

        await supabase
          .from('oh_bookings')
          .update({ feedback_sent_at: new Date().toISOString() })
          .eq('id', booking.id);

        feedbackSent++;
      } catch (err) {
        console.error('Failed to send feedback request:', err);
      }
    }
  }

  // Send recording emails for slots that have recordings but haven't been sent
  const { data: slotsWithRecordings } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(*)
    `)
    .not('recording_link', 'is', null)
    .eq('is_cancelled', false);

  for (const slot of slotsWithRecordings || []) {
    const { data: admin } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', slot.event.host_email)
      .single();

    if (!admin?.google_access_token || !admin?.google_refresh_token) continue;

    for (const booking of slot.bookings || []) {
      if (booking.cancelled_at) continue;
      if (booking.recording_sent_at) continue;

      try {
        const htmlBody = `
          <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
            <h2>Session Recording Available</h2>
            <p>Hi ${booking.first_name},</p>
            <p>The recording for <strong>${slot.event.name}</strong> is now available!</p>
            <div style="margin: 24px 0;">
              <a href="${slot.recording_link}" style="background: #6F71EE; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Watch Recording
              </a>
            </div>
            <p>Best,<br>${slot.event.host_name}</p>
          </div>
        `;

        await sendEmail(
          admin.google_access_token,
          admin.google_refresh_token,
          {
            to: booking.email,
            subject: `Recording: ${slot.event.name}`,
            replyTo: slot.event.host_email,
            htmlBody,
          }
        );

        await supabase
          .from('oh_bookings')
          .update({ recording_sent_at: new Date().toISOString() })
          .eq('id', booking.id);

        recordingsSent++;
      } catch (err) {
        console.error('Failed to send recording email:', err);
      }
    }
  }

  return NextResponse.json({
    success: true,
    feedbackSent,
    recordingsSent,
  });
}
