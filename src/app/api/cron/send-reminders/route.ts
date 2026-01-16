import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/google';
import {
  processTemplate,
  createEmailVariables,
  defaultTemplates,
  htmlifyEmailBody,
} from '@/lib/email-templates';
import { getSMSConfig, sendSMS, processSMSTemplate, defaultSMSTemplates } from '@/lib/sms';
import { addHours, isAfter, isBefore } from 'date-fns';

// This endpoint is designed to be called by Vercel Cron
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/send-reminders", "schedule": "0 * * * *" }] }

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const now = new Date();
  const in1Hour = addHours(now, 1);
  const in24Hours = addHours(now, 24);
  const in25Hours = addHours(now, 25);

  let emailRemindersSent = 0;
  let smsRemindersSent = 0;
  const errors: string[] = [];

  // Check if SMS is configured globally
  const smsConfig = await getSMSConfig();

  // Get all upcoming slots within the next 25 hours
  const { data: slots, error: slotsError } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(*,
        assigned_host:oh_admins!assigned_host_id(id, name, email)
      )
    `)
    .eq('is_cancelled', false)
    .gte('start_time', now.toISOString())
    .lte('start_time', in25Hours.toISOString());

  if (slotsError) {
    console.error('Error fetching slots:', slotsError);
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
  }

  for (const slot of slots || []) {
    const slotTime = new Date(slot.start_time);

    // Get admin tokens
    const { data: admin } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', slot.event.host_email)
      .single();

    if (!admin?.google_access_token || !admin?.google_refresh_token) {
      continue;
    }

    for (const booking of slot.bookings || []) {
      // Skip cancelled bookings
      if (booking.cancelled_at) continue;

      // Determine which reminder to send
      let reminderType: '24h' | '1h' | null = null;
      let reminderTiming = '';

      // Check for 24-hour reminder (send when slot is 23-25 hours away)
      if (
        !booking.reminder_24h_sent_at &&
        isAfter(slotTime, in24Hours) &&
        isBefore(slotTime, in25Hours)
      ) {
        reminderType = '24h';
        reminderTiming = 'tomorrow';
      }

      // Check for 1-hour reminder (send when slot is 0.5-1.5 hours away)
      const in30Min = addHours(now, 0.5);
      const in90Min = addHours(now, 1.5);
      if (
        !booking.reminder_1h_sent_at &&
        isAfter(slotTime, in30Min) &&
        isBefore(slotTime, in90Min)
      ) {
        reminderType = '1h';
        reminderTiming = 'in about 1 hour';
      }

      if (!reminderType) continue;

      try {
        // Use attendee's stored timezone, fall back to event's display timezone, then default
        const emailTimezone = booking.attendee_timezone || slot.event.display_timezone || 'America/New_York';

        // Get assigned host for round-robin bookings
        const assignedHost = booking.assigned_host as { id: string; name: string | null; email: string } | null;

        const variables = createEmailVariables(
          booking,
          { ...slot.event, meeting_type: slot.event.meeting_type },
          slot,
          emailTimezone,
          reminderTiming,
          assignedHost
        );

        const subject = processTemplate(
          slot.event.reminder_subject || defaultTemplates.reminder_subject,
          variables
        );

        const bodyText = processTemplate(
          slot.event.reminder_body || defaultTemplates.reminder_body,
          variables
        );

        const htmlBody = `
          <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
            ${htmlifyEmailBody(bodyText)}

            ${slot.google_meet_link ? `
              <div style="background: #6F71EE; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <a href="${slot.google_meet_link}" style="color: white; text-decoration: none; font-weight: 600;">
                  Join Google Meet →
                </a>
              </div>
            ` : ''}
          </div>
        `;

        await sendEmail(
          admin.google_access_token,
          admin.google_refresh_token,
          {
            to: booking.email,
            subject,
            replyTo: slot.event.host_email,
            htmlBody,
          }
        );

        // Update the booking to mark email reminder as sent
        const emailUpdateField =
          reminderType === '24h' ? 'reminder_24h_sent_at' : 'reminder_1h_sent_at';

        await supabase
          .from('oh_bookings')
          .update({ [emailUpdateField]: new Date().toISOString() })
          .eq('id', booking.id);

        emailRemindersSent++;
        console.log(`Sent ${reminderType} email reminder to ${booking.email} for slot ${slot.id}`);

        // === SMS REMINDER ===
        // Check if SMS should be sent for this booking
        const shouldSendSMS =
          smsConfig?.is_active &&
          slot.event.sms_reminders_enabled &&
          booking.sms_consent &&
          booking.phone;

        if (shouldSendSMS) {
          // Check if SMS reminder not already sent
          const smsFieldToCheck = reminderType === '24h' ? 'sms_reminder_24h_sent_at' : 'sms_reminder_1h_sent_at';
          const smsSentAt = booking[smsFieldToCheck];

          if (!smsSentAt) {
            try {
              // Get the SMS template
              const smsTemplate = reminderType === '24h'
                ? (slot.event.sms_reminder_24h_template || defaultSMSTemplates.reminder_24h)
                : (slot.event.sms_reminder_1h_template || defaultSMSTemplates.reminder_1h);

              // Process the template with variables (cast to Record type for SMS)
              const smsMessage = processSMSTemplate(smsTemplate, variables as unknown as Record<string, string | undefined>);

              // Send the SMS
              const smsSent = await sendSMS(booking.phone, smsMessage);

              if (smsSent) {
                // Update the booking to mark SMS reminder as sent
                const smsUpdateField = reminderType === '24h' ? 'sms_reminder_24h_sent_at' : 'sms_reminder_1h_sent_at';

                await supabase
                  .from('oh_bookings')
                  .update({ [smsUpdateField]: new Date().toISOString() })
                  .eq('id', booking.id);

                smsRemindersSent++;
                console.log(`Sent ${reminderType} SMS reminder to ${booking.phone} for slot ${slot.id}`);
              }
            } catch (smsErr) {
              console.error(`Failed to send SMS reminder to ${booking.phone}:`, smsErr);
              // Don't fail the whole job for SMS errors
            }
          }
        }
        // === END SMS REMINDER ===
      } catch (err) {
        const errorMsg = `Failed to send reminder to ${booking.email}: ${err}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
  }

  return NextResponse.json({
    success: true,
    emailRemindersSent,
    smsRemindersSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}
