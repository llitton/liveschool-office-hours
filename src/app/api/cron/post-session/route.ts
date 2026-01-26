import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/google';

// This cron job runs hourly to handle post-session tasks:
// 1. Send follow-up emails 2 hours after session ends (to attended attendees)
// 2. Send no-show re-engagement emails (configurable delay, default 2 hours)
// 3. Send feedback requests 1 hour after session ends
// 4. Send recording links when added

export async function GET() {
  const supabase = getServiceSupabase();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let followupSent = 0;
  let noShowSent = 0;
  let feedbackSent = 0;
  let recordingsSent = 0;
  const errors: string[] = [];

  // =============================================
  // 1. Send follow-up emails (2-3 hours after session)
  // =============================================
  const { data: followupSlots } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(*)
    `)
    .eq('is_cancelled', false)
    .lt('end_time', twoHoursAgo.toISOString())
    .gt('end_time', threeHoursAgo.toISOString());

  for (const slot of followupSlots || []) {
    const { data: admin } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', slot.event.host_email)
      .single();

    if (!admin?.google_access_token || !admin?.google_refresh_token) continue;

    for (const booking of slot.bookings || []) {
      // Only send to attended bookings that haven't received follow-up
      if (booking.cancelled_at) continue;
      if (!booking.attended_at) continue;
      if (booking.followup_sent_at) continue;

      try {
        // Get attendee notes for this booking
        const { data: notes } = await supabase
          .from('oh_attendee_notes')
          .select('note')
          .eq('attendee_email', booking.email)
          .order('created_at', { ascending: false })
          .limit(3);

        // Get tasks created during session
        const { data: tasks } = await supabase
          .from('oh_quick_tasks')
          .select('title, completed_at')
          .eq('booking_id', booking.id);

        // Build the email content
        let notesSection = '';
        if (notes && notes.length > 0) {
          notesSection = `
            <div style="background: #F6F6F9; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #101E57; font-size: 16px;">Session Notes</h3>
              ${notes.map(n => `<p style="color: #667085; margin: 8px 0;">${n.note}</p>`).join('')}
            </div>
          `;
        }

        let tasksSection = '';
        if (tasks && tasks.length > 0) {
          tasksSection = `
            <div style="background: #F6F6F9; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #101E57; font-size: 16px;">Follow-up Items</h3>
              <ul style="margin: 0; padding-left: 20px;">
                ${tasks.map(t => `<li style="color: #667085; margin: 4px 0;">${t.title}</li>`).join('')}
              </ul>
            </div>
          `;
        }

        let recordingSection = '';
        if (slot.recording_link) {
          recordingSection = `
            <div style="background: #6F71EE; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <a href="${slot.recording_link}" style="color: white; text-decoration: none; font-weight: 600;">
                Watch Session Recording
              </a>
            </div>
          `;
        }

        const htmlBody = `
          <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
            <h2 style="color: #101E57;">Thanks for joining us!</h2>
            <p>Hi ${booking.first_name},</p>
            <p>Thanks for attending <strong>${slot.event.name}</strong> today! Here's a quick summary of your session.</p>

            ${notesSection}
            ${tasksSection}
            ${recordingSection}

            <p style="color: #667085; margin-top: 20px;">
              Have questions? Just reply to this email and we'll be happy to help.
            </p>

            <p style="margin-top: 24px;">
              Best,<br>
              ${slot.event.host_name}
            </p>

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
            to: booking.email,
            subject: `Thanks for joining ${slot.event.name}!`,
            replyTo: slot.event.host_email,
            htmlBody,
          }
        );

        await supabase
          .from('oh_bookings')
          .update({ followup_sent_at: new Date().toISOString() })
          .eq('id', booking.id);

        followupSent++;
      } catch (err) {
        const errorMsg = `Failed to send follow-up email to ${booking.email}: ${err}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
  }

  // =============================================
  // 2. Send no-show re-engagement emails
  // =============================================
  // Get slots that ended in the last 24 hours with no-show bookings
  const { data: noShowSlots } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(*)
    `)
    .eq('is_cancelled', false)
    .lt('end_time', now.toISOString())
    .gt('end_time', twentyFourHoursAgo.toISOString());

  for (const slot of noShowSlots || []) {
    const event = slot.event;

    // Skip if no-show emails are disabled for this event
    if (event.no_show_emails_enabled === false) continue;

    // Calculate when the no-show email should be sent based on delay setting
    const delayHours = event.no_show_email_delay_hours || 2;
    const sendAfter = new Date(new Date(slot.end_time).getTime() + delayHours * 60 * 60 * 1000);

    // Only send if we're past the delay window
    if (now < sendAfter) continue;

    // Don't send if more than 24 hours have passed (prevent sending old emails)
    const maxSendTime = new Date(new Date(slot.end_time).getTime() + 24 * 60 * 60 * 1000);
    if (now > maxSendTime) continue;

    const { data: admin } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', event.host_email)
      .single();

    if (!admin?.google_access_token || !admin?.google_refresh_token) continue;

    for (const booking of slot.bookings || []) {
      // Only send to no-show bookings that haven't received the email
      if (booking.cancelled_at) continue;
      if (!booking.no_show_at) continue;
      if (booking.no_show_email_sent_at) continue;

      try {
        // Generate re-booking link
        const rebookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/book/${event.slug}`;

        // Use custom template or default
        const subject = event.no_show_subject || `We missed you at ${event.name}!`;

        // Process template variables
        const processTemplate = (template: string) => {
          return template
            .replace(/\{\{first_name\}\}/g, booking.first_name)
            .replace(/\{\{last_name\}\}/g, booking.last_name)
            .replace(/\{\{event_name\}\}/g, event.name)
            .replace(/\{\{host_name\}\}/g, event.host_name)
            .replace(/\{\{rebook_link\}\}/g, rebookUrl);
        };

        let htmlBody: string;

        if (event.no_show_body) {
          // Use custom template
          htmlBody = `
            <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
              ${processTemplate(event.no_show_body)}
              <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; margin-top: 20px; text-align: center;">
                <p style="color: #98A2B3; font-size: 12px; margin: 0;">
                  Sent from Connect with LiveSchool
                </p>
              </div>
            </div>
          `;
        } else {
          // Default no-show template
          htmlBody = `
            <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
              <h2 style="color: #101E57;">We missed you!</h2>
              <p>Hi ${booking.first_name},</p>
              <p>We noticed you weren't able to join <strong>${event.name}</strong> today. No worries - life happens!</p>
              <p>We'd love to connect with you. Feel free to book another session at a time that works better for you.</p>

              <div style="margin: 24px 0; text-align: center;">
                <a href="${rebookUrl}" style="background: #6F71EE; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                  Book Another Session
                </a>
              </div>

              <p style="color: #667085;">
                If you have any questions, just reply to this email.
              </p>

              <p style="margin-top: 24px;">
                Best,<br>
                ${event.host_name}
              </p>

              <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; margin-top: 20px; text-align: center;">
                <p style="color: #98A2B3; font-size: 12px; margin: 0;">
                  Sent from Connect with LiveSchool
                </p>
              </div>
            </div>
          `;
        }

        await sendEmail(
          admin.google_access_token,
          admin.google_refresh_token,
          {
            to: booking.email,
            subject: processTemplate(subject),
            replyTo: event.host_email,
            htmlBody,
          }
        );

        await supabase
          .from('oh_bookings')
          .update({ no_show_email_sent_at: new Date().toISOString() })
          .eq('id', booking.id);

        noShowSent++;
      } catch (err) {
        const errorMsg = `Failed to send no-show email to ${booking.email}: ${err}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
  }

  // =============================================
  // 3. Send feedback requests (1-2 hours after session)
  // =============================================
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
        const feedbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/feedback/${booking.manage_token}`;

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
        const errorMsg = `Failed to send feedback request to ${booking.email}: ${err}`;
        console.error(errorMsg);
        errors.push(errorMsg);
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
        const errorMsg = `Failed to send recording email to ${booking.email}: ${err}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
  }

  // Calculate total attempted and determine if there are critical failures
  const totalSent = followupSent + noShowSent + feedbackSent + recordingsSent;
  const totalAttempted = totalSent + errors.length;
  const hasCriticalFailures = errors.length > 0 && errors.length > totalAttempted / 2;

  if (hasCriticalFailures) {
    return NextResponse.json({
      success: false,
      followupSent,
      noShowSent,
      feedbackSent,
      recordingsSent,
      errors,
      message: 'Critical: More than half of post-session emails failed to send',
    }, { status: 500 });
  }

  return NextResponse.json({
    success: errors.length === 0,
    followupSent,
    noShowSent,
    feedbackSent,
    recordingsSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}
