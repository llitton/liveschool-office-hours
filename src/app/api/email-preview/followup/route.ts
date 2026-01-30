import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/google';
import { generateFollowupEmailHtml } from '@/lib/email-html';

// POST send a test follow-up email preview
// Body: { to: "email@example.com", isNoShow?: boolean, slotId?: string }
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { to, isNoShow = false, slotId } = body;

  if (!to) {
    return NextResponse.json({ error: 'to email address is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Get current user's credentials
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('email', session.email)
    .single();

  if (!admin?.google_access_token || !admin?.google_refresh_token) {
    return NextResponse.json(
      { error: 'Your Google account is not connected.' },
      { status: 400 }
    );
  }

  // If slotId provided, use real data; otherwise use sample data
  let emailData = {
    recipientFirstName: 'Laura',
    eventName: 'LiveSchool Office Hours',
    hostName: admin.name || 'Your Host',
    sessionDate: 'Friday, January 31',
    sessionTime: '10:30 AM',
    timezoneAbbr: 'CT',
    recordingLink: 'https://app.fireflies.ai/view/example-recording',
    deckLink: 'https://docs.google.com/presentation/d/example',
    sharedLinks: [
      { title: 'Getting Started Guide', url: 'https://help.liveschoolinc.com/getting-started' },
      { title: 'Support Center', url: 'https://help.liveschoolinc.com' },
    ],
    bookingPageUrl: `${process.env.NEXT_PUBLIC_APP_URL}/book/office-hours`,
    isNoShow,
    customMessage: isNoShow
      ? undefined
      : 'Thanks so much for joining today! It was great chatting with you about rewards setup.',
  };

  // If a real slotId is provided, fetch actual data
  if (slotId) {
    const { data: slot } = await supabase
      .from('oh_slots')
      .select(`
        *,
        event:oh_events(*)
      `)
      .eq('id', slotId)
      .single();

    if (slot) {
      const event = slot.event;
      const startTime = new Date(slot.start_time);

      emailData = {
        ...emailData,
        eventName: event?.name || 'Session',
        sessionDate: startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        sessionTime: startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        recordingLink: slot.recording_link || emailData.recordingLink,
        deckLink: slot.deck_link || emailData.deckLink,
        sharedLinks: slot.shared_links || emailData.sharedLinks,
        bookingPageUrl: event?.slug
          ? `${process.env.NEXT_PUBLIC_APP_URL}/book/${event.slug}`
          : emailData.bookingPageUrl,
      };
    }
  }

  const htmlBody = generateFollowupEmailHtml(emailData);

  const subject = isNoShow
    ? `We missed you at ${emailData.eventName}!`
    : `Thanks for joining ${emailData.eventName}!`;

  try {
    const result = await sendEmail(
      admin.google_access_token,
      admin.google_refresh_token,
      {
        to,
        subject,
        replyTo: admin.email,
        from: admin.email,
        htmlBody,
      }
    );

    return NextResponse.json({
      success: true,
      sentTo: to,
      sentFrom: admin.email,
      type: isNoShow ? 'no_show' : 'attended',
      messageId: result.messageId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send email', details: String(error) },
      { status: 500 }
    );
  }
}
