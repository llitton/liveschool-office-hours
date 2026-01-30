import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/google';
import { generateFollowupEmailHtml, generateFeedbackEmailHtml, generateRecordingEmailHtml } from '@/lib/email-html';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getTimezoneAbbr } from '@/lib/timezone';

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
    // Skip if automated emails are disabled for this event or this slot
    if (slot.event.automated_emails_enabled === false) continue;
    if (slot.skip_automated_emails === true) continue;

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

        // Build custom message with notes and tasks if available
        let customMessageParts: string[] = [];

        if (notes && notes.length > 0) {
          customMessageParts.push('Session notes:\n' + notes.map(n => `• ${n.note}`).join('\n'));
        }

        if (tasks && tasks.length > 0) {
          customMessageParts.push('Follow-up items:\n' + tasks.map(t => `• ${t.title}`).join('\n'));
        }

        const customMessage = customMessageParts.length > 0
          ? customMessageParts.join('\n\n')
          : 'Thanks so much for joining today! It was great chatting with you.';

        // Format session date/time in event's timezone
        const event = slot.event;
        const eventTimezone = event?.timezone || 'America/Chicago';
        const startTime = parseISO(slot.start_time);
        const zonedTime = toZonedTime(startTime, eventTimezone);
        const sessionDate = format(zonedTime, 'EEEE, MMMM d');
        const sessionTime = format(zonedTime, 'h:mm a');
        const timezoneAbbr = getTimezoneAbbr(eventTimezone);

        // Build booking page URL
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        const bookingPageUrl = event?.slug ? `${appUrl}/book/${event.slug}` : appUrl;

        const htmlBody = generateFollowupEmailHtml({
          recipientFirstName: booking.first_name,
          eventName: event?.name || 'Session',
          hostName: event?.host_name || 'Your Host',
          sessionDate,
          sessionTime,
          timezoneAbbr,
          recordingLink: slot.recording_link,
          deckLink: slot.deck_link,
          sharedLinks: slot.shared_links,
          bookingPageUrl,
          isNoShow: false,
          customMessage,
        });

        await sendEmail(
          admin.google_access_token,
          admin.google_refresh_token,
          {
            to: booking.email,
            subject: `Thanks for joining ${slot.event.name}!`,
            replyTo: slot.event.host_email,
            from: slot.event.host_email,
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

    // Skip if automated emails are disabled for this event or this slot
    if (event.automated_emails_enabled === false) continue;
    if (slot.skip_automated_emails === true) continue;

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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        const bookingPageUrl = event.slug ? `${appUrl}/book/${event.slug}` : appUrl;

        // Use custom subject template or default
        const subjectTemplate = event.no_show_subject || `We missed you at ${event.name}!`;

        // Process template variables in subject
        const subject = subjectTemplate
          .replace(/\{\{first_name\}\}/g, booking.first_name)
          .replace(/\{\{last_name\}\}/g, booking.last_name)
          .replace(/\{\{event_name\}\}/g, event.name)
          .replace(/\{\{host_name\}\}/g, event.host_name);

        // Format session date/time in event's timezone
        const eventTimezone = event?.timezone || 'America/Chicago';
        const startTime = parseISO(slot.start_time);
        const zonedTime = toZonedTime(startTime, eventTimezone);
        const sessionDate = format(zonedTime, 'EEEE, MMMM d');
        const sessionTime = format(zonedTime, 'h:mm a');
        const timezoneAbbr = getTimezoneAbbr(eventTimezone);

        // Use custom body as custom message if provided, otherwise use default
        let customMessage: string | undefined;
        if (event.no_show_body) {
          customMessage = event.no_show_body
            .replace(/\{\{first_name\}\}/g, booking.first_name)
            .replace(/\{\{last_name\}\}/g, booking.last_name)
            .replace(/\{\{event_name\}\}/g, event.name)
            .replace(/\{\{host_name\}\}/g, event.host_name)
            .replace(/\{\{rebook_link\}\}/g, bookingPageUrl);
        }

        const htmlBody = generateFollowupEmailHtml({
          recipientFirstName: booking.first_name,
          eventName: event?.name || 'Session',
          hostName: event?.host_name || 'Your Host',
          sessionDate,
          sessionTime,
          timezoneAbbr,
          bookingPageUrl,
          isNoShow: true,
          customMessage,
        });

        await sendEmail(
          admin.google_access_token,
          admin.google_refresh_token,
          {
            to: booking.email,
            subject,
            replyTo: event.host_email,
            from: event.host_email,
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
    // Skip if automated emails are disabled for this event or this slot
    if (slot.event.automated_emails_enabled === false) continue;
    if (slot.skip_automated_emails === true) continue;

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

        // Format session date/time in event's timezone
        const event = slot.event;
        const eventTimezone = event?.timezone || 'America/Chicago';
        const startTime = parseISO(slot.start_time);
        const zonedTime = toZonedTime(startTime, eventTimezone);
        const sessionDate = format(zonedTime, 'EEEE, MMMM d');
        const sessionTime = format(zonedTime, 'h:mm a');
        const timezoneAbbr = getTimezoneAbbr(eventTimezone);

        const htmlBody = generateFeedbackEmailHtml({
          recipientFirstName: booking.first_name,
          eventName: event?.name || 'Session',
          hostName: event?.host_name || 'Your Host',
          sessionDate,
          sessionTime,
          timezoneAbbr,
          feedbackUrl,
        });

        await sendEmail(
          admin.google_access_token,
          admin.google_refresh_token,
          {
            to: booking.email,
            subject: `How was ${slot.event.name}?`,
            replyTo: slot.event.host_email,
            from: slot.event.host_email,
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
    // Skip if automated emails are disabled for this event or this slot
    if (slot.event.automated_emails_enabled === false) continue;
    if (slot.skip_automated_emails === true) continue;

    const { data: admin } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', slot.event.host_email)
      .single();

    if (!admin?.google_access_token || !admin?.google_refresh_token) continue;

    // Format session date/time in event's timezone (once per slot)
    const event = slot.event;
    const eventTimezone = event?.timezone || 'America/Chicago';
    const startTime = parseISO(slot.start_time);
    const zonedTime = toZonedTime(startTime, eventTimezone);
    const sessionDate = format(zonedTime, 'EEEE, MMMM d');
    const sessionTime = format(zonedTime, 'h:mm a');
    const timezoneAbbr = getTimezoneAbbr(eventTimezone);

    // Build booking page URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const bookingPageUrl = event?.slug ? `${appUrl}/book/${event.slug}` : undefined;

    for (const booking of slot.bookings || []) {
      if (booking.cancelled_at) continue;
      if (booking.recording_sent_at) continue;

      try {
        const htmlBody = generateRecordingEmailHtml({
          recipientFirstName: booking.first_name,
          eventName: event?.name || 'Session',
          hostName: event?.host_name || 'Your Host',
          sessionDate,
          sessionTime,
          timezoneAbbr,
          recordingLink: slot.recording_link,
          deckLink: slot.deck_link,
          sharedLinks: slot.shared_links,
          bookingPageUrl,
        });

        await sendEmail(
          admin.google_access_token,
          admin.google_refresh_token,
          {
            to: booking.email,
            subject: `Recording: ${slot.event.name}`,
            replyTo: slot.event.host_email,
            from: slot.event.host_email,
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
