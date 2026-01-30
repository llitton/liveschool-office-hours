import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/google';
import { generateFollowupEmailHtml } from '@/lib/email-html';
import { emailLogger } from '@/lib/logger';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getTimezoneAbbr } from '@/lib/timezone';

// POST send bulk follow-up emails to attendees or no-shows
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { recipients, subject, body: emailBody } = body;

  if (!recipients || !subject || !emailBody) {
    return NextResponse.json(
      { error: 'recipients, subject, and body are required' },
      { status: 400 }
    );
  }

  if (!['attended', 'no_show'].includes(recipients)) {
    return NextResponse.json(
      { error: 'recipients must be "attended" or "no_show"' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get the slot with event and bookings
  const { data: slot, error: slotError } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(*)
    `)
    .eq('id', id)
    .single();

  if (slotError || !slot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }

  // Filter bookings based on recipient type
  const targetBookings = (slot.bookings || []).filter(
    (b: { id: string; cancelled_at: string | null; attended_at: string | null; no_show_at: string | null }) => {
      if (b.cancelled_at) return false;
      if (recipients === 'attended') return !!b.attended_at;
      if (recipients === 'no_show') return !!b.no_show_at;
      return false;
    }
  );

  if (targetBookings.length === 0) {
    return NextResponse.json(
      { error: `No ${recipients === 'attended' ? 'attendees' : 'no-shows'} to email` },
      { status: 400 }
    );
  }

  // Get current user's credentials for sending email (send from whoever clicks the button)
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('email', session.email)
    .single();

  if (!admin?.google_access_token || !admin?.google_refresh_token) {
    return NextResponse.json(
      { error: 'Your Google account is not connected. Please reconnect Google in Settings.' },
      { status: 400 }
    );
  }

  // Get host info for the email template
  const event = slot.event;
  const eventTimezone = event?.timezone || 'America/Chicago';

  // Format session date/time in event's timezone
  const startTime = parseISO(slot.start_time);
  const zonedTime = toZonedTime(startTime, eventTimezone);
  const sessionDate = format(zonedTime, 'EEEE, MMMM d');
  const sessionTime = format(zonedTime, 'h:mm a');
  const timezoneAbbr = getTimezoneAbbr(eventTimezone);

  // Build booking page URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const bookingPageUrl = event?.slug ? `${appUrl}/book/${event.slug}` : appUrl;

  // Get host name (primary host or event creator)
  const hostName = event?.host_name || admin.name || 'Your Host';

  // Send emails
  const isNoShow = recipients === 'no_show';
  const results = await Promise.allSettled(
    targetBookings.map(async (booking: { id: string; first_name: string; email: string }) => {
      // Replace {{first_name}} placeholder if present in custom body
      const customMessage = emailBody.replace(/\{\{first_name\}\}/g, booking.first_name);

      const htmlBody = generateFollowupEmailHtml({
        recipientFirstName: booking.first_name,
        eventName: event?.name || 'Session',
        hostName,
        sessionDate,
        sessionTime,
        timezoneAbbr,
        recordingLink: slot.recording_link,
        deckLink: slot.deck_link,
        sharedLinks: slot.shared_links,
        bookingPageUrl,
        isNoShow,
        customMessage,
      });

      const result = await sendEmail(
        admin.google_access_token!,
        admin.google_refresh_token!,
        {
          to: booking.email,
          subject,
          replyTo: admin.email,
          from: admin.email,
          htmlBody,
        }
      );

      return { id: booking.id, email: booking.email, messageId: result.messageId };
    })
  );

  const successfulResults = results.filter((r): r is PromiseFulfilledResult<{ id: string; email: string; messageId: string }> =>
    r.status === 'fulfilled'
  );
  const failedResults = results.filter((r): r is PromiseRejectedResult =>
    r.status === 'rejected'
  );

  const sent = successfulResults.length;
  const failed = failedResults.length;

  // Mark bookings as having received follow-up to prevent duplicate automated emails
  if (successfulResults.length > 0) {
    const bookingIds = successfulResults.map(r => r.value.id);
    const updateColumn = recipients === 'attended' ? 'followup_sent_at' : 'no_show_email_sent_at';

    await supabase
      .from('oh_bookings')
      .update({ [updateColumn]: new Date().toISOString() })
      .in('id', bookingIds);
  }

  emailLogger.info(`Follow-up emails sent from ${admin.email}`, {
    operation: 'sendFollowup',
    slotId: id,
    adminId: admin.id,
    metadata: {
      sent,
      failed,
      sentBy: admin.email,
      recipients: successfulResults.map(r => r.value.email),
      messageIds: successfulResults.map(r => r.value.messageId),
      errors: failedResults.map(r => String(r.reason)),
    },
  });

  return NextResponse.json({
    success: true,
    sent,
    failed,
    sentFrom: admin.email,
  });
}
