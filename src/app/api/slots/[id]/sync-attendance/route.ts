import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { getMeetParticipants, matchParticipantsToBookings } from '@/lib/google';
import { updateMeetingOutcome } from '@/lib/hubspot';

// POST sync attendance from Google Meet
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
  const minDuration = body.minDuration || 5; // Minimum minutes to count as attended

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

  if (!slot.google_meet_link) {
    return NextResponse.json(
      { error: 'This slot does not have a Google Meet link' },
      { status: 400 }
    );
  }

  // Get admin credentials
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('email', slot.event.host_email)
    .single();

  if (!admin?.google_access_token || !admin?.google_refresh_token) {
    return NextResponse.json(
      { error: 'Host Google account not connected. Please reconnect in Integrations.' },
      { status: 400 }
    );
  }

  // Get participants from Google Meet
  const { participants, error: meetError } = await getMeetParticipants(
    admin.google_access_token,
    admin.google_refresh_token,
    slot.google_meet_link,
    slot.start_time,
    slot.end_time
  );

  if (meetError) {
    return NextResponse.json({ error: meetError }, { status: 400 });
  }

  // Filter to only non-cancelled, unmarked bookings
  const eligibleBookings = (slot.bookings || []).filter(
    (b: { cancelled_at: string | null; attended_at: string | null; no_show_at: string | null }) =>
      !b.cancelled_at && !b.attended_at && !b.no_show_at
  );

  if (eligibleBookings.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No unmarked bookings to sync',
      synced: 0,
      attended: 0,
      noShow: 0,
      participants: participants.length,
    });
  }

  // Match participants to bookings
  const matches = matchParticipantsToBookings(
    participants,
    eligibleBookings.map((b: { id: string; email: string; first_name: string; last_name: string }) => ({
      id: b.id,
      email: b.email,
      first_name: b.first_name,
      last_name: b.last_name,
    })),
    minDuration
  );

  // Update bookings based on matches
  let attended = 0;
  let noShow = 0;

  for (const match of matches) {
    const updates: Record<string, unknown> = {};

    if (match.attended) {
      updates.attended_at = new Date().toISOString();
      attended++;
    } else {
      updates.no_show_at = new Date().toISOString();
      noShow++;
    }

    // Update the booking
    await supabase
      .from('oh_bookings')
      .update(updates)
      .eq('id', match.bookingId);

    // Sync to HubSpot if contact exists
    const booking = eligibleBookings.find((b: { id: string }) => b.id === match.bookingId);
    if (booking?.hubspot_contact_id) {
      const hubspotOutcome = match.attended ? 'COMPLETED' : 'NO_SHOW';
      updateMeetingOutcome(
        booking.hubspot_contact_id,
        slot.event.name,
        hubspotOutcome
      ).catch((err) => console.error('Failed to sync HubSpot outcome:', err));
    }
  }

  return NextResponse.json({
    success: true,
    synced: matches.length,
    attended,
    noShow,
    participants: participants.length,
    matches: matches.map((m) => ({
      email: m.email,
      attended: m.attended,
      duration: m.duration,
      matchedBy: m.matchedBy,
    })),
  });
}
