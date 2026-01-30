import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { sendDetailedSessionSummary } from '@/lib/slack';

// POST send wrap-up summary to Slack
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: slotId } = await params;
  const supabase = getServiceSupabase();

  // Get slot with event and bookings
  // Note: deck_link and shared_links added in migration 041
  const { data: slot, error: slotError } = await supabase
    .from('oh_slots')
    .select(`
      id,
      start_time,
      end_time,
      recording_link,
      deck_link,
      shared_links,
      event:oh_events!inner(
        id,
        name,
        slug,
        display_timezone,
        custom_questions,
        slack_notifications_enabled
      ),
      bookings:oh_bookings(
        id,
        first_name,
        last_name,
        email,
        attended_at,
        no_show_at,
        cancelled_at,
        question_responses
      )
    `)
    .eq('id', slotId)
    .single();

  if (slotError || !slot) {
    console.error('[wrap-up-summary] Slot query error:', slotError, 'slotId:', slotId);
    return NextResponse.json({
      error: slotError?.message || 'Slot not found',
      code: slotError?.code,
      hint: slotError?.hint,
    }, { status: 404 });
  }

  const eventData = slot.event as unknown as {
    id: string;
    name: string;
    slug: string;
    display_timezone: string | null;
    custom_questions: Array<{ id: string; question: string }> | null;
    slack_notifications_enabled: boolean;
  };

  // Check if Slack notifications are enabled for this event
  if (!eventData.slack_notifications_enabled) {
    return NextResponse.json({
      error: 'Slack notifications are not enabled for this event',
      sent: false
    }, { status: 400 });
  }

  const bookings = (slot.bookings as Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    attended_at: string | null;
    no_show_at: string | null;
    cancelled_at: string | null;
    question_responses: Record<string, string> | null;
  }>) || [];

  // Filter out cancelled bookings
  const activeBookings = bookings.filter(b => !b.cancelled_at);

  if (activeBookings.length === 0) {
    return NextResponse.json({
      error: 'No attendees to report',
      sent: false
    }, { status: 400 });
  }

  // Build attendee data
  const attendees = activeBookings.map(b => ({
    name: `${b.first_name} ${b.last_name}`,
    email: b.email,
    attended: !!b.attended_at,
    noShow: !!b.no_show_at,
    questionResponses: b.question_responses,
  }));

  // Send to Slack
  const sent = await sendDetailedSessionSummary({
    eventName: eventData.name,
    eventId: eventData.id,
    slotId: slotId,
    startTime: slot.start_time,
    timezone: eventData.display_timezone,
    attendees,
    customQuestions: eventData.custom_questions,
    recordingLink: slot.recording_link,
    deckLink: slot.deck_link,
    sharedLinks: slot.shared_links as Array<{ title: string; url: string }> | null,
  });

  if (!sent) {
    return NextResponse.json({
      error: 'Failed to send to Slack. Check your Slack configuration.',
      sent: false
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    sent: true,
    attendeeCount: attendees.length,
    attendedCount: attendees.filter(a => a.attended).length,
    noShowCount: attendees.filter(a => a.noShow).length,
  });
}
