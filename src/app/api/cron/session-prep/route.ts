import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/google';
import { getContactWithCompany } from '@/lib/hubspot';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

// This cron job runs at 7am ET daily to send Hannah a morning digest
// of all attendees for today's sessions

export async function GET() {
  const supabase = getServiceSupabase();
  const now = new Date();
  const timezone = 'America/New_York';

  // Get today's date boundaries in ET
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  let emailsSent = 0;

  // Get all slots for today with bookings
  const { data: todaySlots, error } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(*)
    `)
    .eq('is_cancelled', false)
    .gte('start_time', todayStart.toISOString())
    .lte('start_time', todayEnd.toISOString())
    .order('start_time', { ascending: true });

  if (error || !todaySlots || todaySlots.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No sessions today',
      emailsSent: 0,
    });
  }

  // Group slots by event/host
  const slotsByHost: Record<
    string,
    {
      hostName: string;
      hostEmail: string;
      eventName: string;
      slots: typeof todaySlots;
    }
  > = {};

  for (const slot of todaySlots) {
    const hostEmail = slot.event.host_email;
    if (!slotsByHost[hostEmail]) {
      slotsByHost[hostEmail] = {
        hostName: slot.event.host_name,
        hostEmail,
        eventName: slot.event.name,
        slots: [],
      };
    }
    slotsByHost[hostEmail].slots.push(slot);
  }

  // Send prep email to each host
  for (const [hostEmail, hostData] of Object.entries(slotsByHost)) {
    // Get admin tokens
    const { data: admin } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', hostEmail)
      .single();

    if (!admin?.google_access_token || !admin?.google_refresh_token) {
      console.log(`No tokens for host: ${hostEmail}`);
      continue;
    }

    // Count total attendees
    const totalAttendees = hostData.slots.reduce(
      (sum, slot) =>
        sum + (slot.bookings?.filter((b: { cancelled_at: string | null }) => !b.cancelled_at).length || 0),
      0
    );

    if (totalAttendees === 0) {
      console.log(`No attendees for host: ${hostEmail}`);
      continue;
    }

    // Build session sections
    const sessionSections = await Promise.all(
      hostData.slots.map(async (slot) => {
        const activeBookings = (slot.bookings || []).filter(
          (b: { cancelled_at: string | null }) => !b.cancelled_at
        );
        if (activeBookings.length === 0) return '';

        const startTime = formatInTimeZone(
          parseISO(slot.start_time),
          timezone,
          'h:mm a'
        );
        const endTime = formatInTimeZone(
          parseISO(slot.end_time),
          timezone,
          'h:mm a'
        );

        // Build attendee list with context
        const attendeeRows = await Promise.all(
          activeBookings.map(
            async (booking: {
              email: string;
              first_name: string;
              last_name: string;
              question_responses: Record<string, string> | null;
            }) => {
              // Get HubSpot info
              let companyName = '';
              try {
                const hubspotData = await getContactWithCompany(booking.email);
                if (hubspotData?.company) {
                  companyName = hubspotData.company.name;
                }
              } catch (e) {
                // Ignore HubSpot errors
              }

              // Get session history
              const { data: previousBookings } = await supabase
                .from('oh_bookings')
                .select('id, question_responses, attended_at')
                .eq('email', booking.email)
                .is('cancelled_at', null)
                .lt('created_at', slot.created_at);

              const attendedCount =
                previousBookings?.filter((b) => b.attended_at).length || 0;
              const isReturning = (previousBookings?.length || 0) > 0;

              // Get their topic/question
              let topic = '';
              if (booking.question_responses) {
                const responses = Object.values(booking.question_responses);
                topic = responses.find((r) => typeof r === 'string' && r.trim()) || '';
              }

              // Get previous topics
              const previousTopics: string[] = [];
              for (const prev of previousBookings || []) {
                if (prev.question_responses) {
                  const responses = Object.values(
                    prev.question_responses as Record<string, string>
                  );
                  for (const r of responses) {
                    if (typeof r === 'string' && r.trim()) {
                      previousTopics.push(r.slice(0, 50));
                    }
                  }
                }
              }

              return `
              <div style="background: #F6F6F9; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                  <div>
                    <strong style="color: #101E57;">${booking.first_name} ${booking.last_name}</strong>
                    ${companyName ? `<span style="color: #667085;"> (${companyName})</span>` : ''}
                    ${
                      isReturning
                        ? `<span style="background: #6F71EE20; color: #6F71EE; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px;">
                            ${attendedCount > 2 ? 'Frequent' : 'Returning'} (${attendedCount + 1} sessions)
                          </span>`
                        : `<span style="background: #41776220; color: #417762; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px;">
                            First-time
                          </span>`
                    }
                  </div>
                </div>
                ${
                  topic
                    ? `<div style="margin-top: 8px;">
                        <p style="color: #667085; font-size: 13px; margin: 0;">Topic: <em>"${topic.slice(0, 100)}${topic.length > 100 ? '...' : ''}"</em></p>
                      </div>`
                    : ''
                }
                ${
                  previousTopics.length > 0
                    ? `<div style="margin-top: 4px;">
                        <p style="color: #98A2B3; font-size: 12px; margin: 0;">
                          Previous: ${previousTopics.slice(0, 2).join(', ')}
                        </p>
                      </div>`
                    : ''
                }
              </div>
            `;
            }
          )
        );

        return `
          <div style="margin-bottom: 24px;">
            <div style="background: #6F71EE; color: white; padding: 12px 16px; border-radius: 8px 8px 0 0;">
              <strong>${startTime} - ${endTime}</strong>
              <span style="margin-left: 8px; opacity: 0.9;">(${activeBookings.length} attendee${activeBookings.length !== 1 ? 's' : ''})</span>
            </div>
            <div style="border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px; padding: 16px;">
              ${attendeeRows.join('')}
            </div>
          </div>
        `;
      })
    );

    const todayFormatted = format(now, 'EEEE, MMMM d');

    const htmlBody = `
      <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #101E57;">
        <h2 style="color: #101E57; margin-bottom: 8px;">Good morning, ${hostData.hostName.split(' ')[0]}!</h2>
        <p style="color: #667085; margin-top: 0;">
          Here's your session prep for <strong>${todayFormatted}</strong>.
        </p>

        <div style="background: #6F71EE10; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #101E57;">
            <strong>${totalAttendees}</strong> attendee${totalAttendees !== 1 ? 's' : ''} across
            <strong>${hostData.slots.filter((s) => (s.bookings?.filter((b: { cancelled_at: string | null }) => !b.cancelled_at).length || 0) > 0).length}</strong> session${hostData.slots.length !== 1 ? 's' : ''}
          </p>
        </div>

        ${sessionSections.filter(Boolean).join('')}

        <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; margin-top: 20px; text-align: center;">
          <p style="color: #98A2B3; font-size: 12px; margin: 0;">
            Sent from LiveSchool Office Hours
          </p>
        </div>
      </div>
    `;

    try {
      await sendEmail(admin.google_access_token, admin.google_refresh_token, {
        to: hostEmail,
        subject: `Your sessions today: ${totalAttendees} attendee${totalAttendees !== 1 ? 's' : ''} booked`,
        replyTo: hostEmail,
        htmlBody,
      });
      emailsSent++;
    } catch (err) {
      console.error('Failed to send prep email:', err);
    }
  }

  return NextResponse.json({
    success: true,
    emailsSent,
  });
}
