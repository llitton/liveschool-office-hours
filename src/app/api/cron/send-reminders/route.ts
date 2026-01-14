import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/google';
import {
  processTemplate,
  createEmailVariables,
  defaultTemplates,
  htmlifyEmailBody,
} from '@/lib/email-templates';
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

  let remindersSent = 0;
  const errors: string[] = [];

  // Get all upcoming slots within the next 25 hours
  const { data: slots, error: slotsError } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(*)
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

        const variables = createEmailVariables(
          booking,
          slot.event,
          slot,
          emailTimezone,
          reminderTiming
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

        // Update the booking to mark reminder as sent
        const updateField =
          reminderType === '24h' ? 'reminder_24h_sent_at' : 'reminder_1h_sent_at';

        await supabase
          .from('oh_bookings')
          .update({ [updateField]: new Date().toISOString() })
          .eq('id', booking.id);

        remindersSent++;
        console.log(`Sent ${reminderType} reminder to ${booking.email} for slot ${slot.id}`);
      } catch (err) {
        const errorMsg = `Failed to send reminder to ${booking.email}: ${err}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
  }

  return NextResponse.json({
    success: true,
    remindersSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}
