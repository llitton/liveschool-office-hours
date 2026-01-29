import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getMeetParticipants, matchParticipantsToBookings } from '@/lib/google';
import { updateMeetingOutcome } from '@/lib/hubspot';
import { cronLogger } from '@/lib/logger';

// This cron job runs every hour (at :45) to automatically sync attendance
// from Google Meet for sessions that ended 30-90 minutes ago.
// This gives time for the meeting to fully end and for Meet to process
// participant data before we fetch it.

const MIN_ATTENDANCE_DURATION = 5; // Minutes required to count as attended

export async function GET() {
  const supabase = getServiceSupabase();
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000);

  let slotsProcessed = 0;
  let bookingsMarkedAttended = 0;
  let bookingsMarkedNoShow = 0;
  const errors: string[] = [];

  // Find slots that ended 30-90 minutes ago with Google Meet links
  // and have unmarked bookings
  const { data: slots, error: slotsError } = await supabase
    .from('oh_slots')
    .select(`
      *,
      event:oh_events(*),
      bookings:oh_bookings(*)
    `)
    .eq('is_cancelled', false)
    .not('google_meet_link', 'is', null)
    .lt('end_time', thirtyMinutesAgo.toISOString())
    .gt('end_time', ninetyMinutesAgo.toISOString());

  if (slotsError) {
    cronLogger.error('Failed to fetch slots for auto-attendance', {
      operation: 'auto-attendance',
    }, slotsError);
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
  }

  for (const slot of slots || []) {
    // Filter to only non-cancelled, unmarked bookings
    const unmarkedBookings = (slot.bookings || []).filter(
      (b: { cancelled_at: string | null; attended_at: string | null; no_show_at: string | null }) =>
        !b.cancelled_at && !b.attended_at && !b.no_show_at
    );

    // Skip if no unmarked bookings
    if (unmarkedBookings.length === 0) continue;

    // Get admin credentials for the host
    const { data: admin } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', slot.event.host_email)
      .single();

    if (!admin?.google_access_token || !admin?.google_refresh_token) {
      cronLogger.warn('Host Google not connected, skipping auto-attendance', {
        operation: 'auto-attendance',
        eventId: slot.event.id,
        metadata: { slotId: slot.id, hostEmail: slot.event.host_email },
      });
      continue;
    }

    try {
      // Get participants from Google Meet
      const { participants, error: meetError } = await getMeetParticipants(
        admin.google_access_token,
        admin.google_refresh_token,
        slot.google_meet_link,
        slot.start_time,
        slot.end_time
      );

      if (meetError) {
        cronLogger.warn('Failed to get Meet participants', {
          operation: 'auto-attendance',
          eventId: slot.event.id,
          metadata: { slotId: slot.id, error: meetError },
        });
        errors.push(`Slot ${slot.id}: ${meetError}`);
        continue;
      }

      // Match participants to bookings
      const matches = matchParticipantsToBookings(
        participants,
        unmarkedBookings.map((b: { id: string; email: string; first_name: string; last_name: string }) => ({
          id: b.id,
          email: b.email,
          first_name: b.first_name,
          last_name: b.last_name,
        })),
        MIN_ATTENDANCE_DURATION
      );

      // Update bookings based on matches
      for (const match of matches) {
        const updates: Record<string, unknown> = {};

        if (match.attended) {
          updates.attended_at = new Date().toISOString();
          bookingsMarkedAttended++;
        } else {
          updates.no_show_at = new Date().toISOString();
          bookingsMarkedNoShow++;
        }

        // Update the booking
        await supabase
          .from('oh_bookings')
          .update(updates)
          .eq('id', match.bookingId);

        // Sync to HubSpot if contact exists
        const booking = unmarkedBookings.find((b: { id: string }) => b.id === match.bookingId);
        if (booking?.hubspot_contact_id) {
          const hubspotOutcome = match.attended ? 'COMPLETED' : 'NO_SHOW';
          updateMeetingOutcome(
            booking.hubspot_contact_id,
            slot.event.name,
            hubspotOutcome
          ).catch((err) => console.error('Failed to sync HubSpot outcome:', err));
        }
      }

      slotsProcessed++;

      cronLogger.info('Auto-synced attendance for slot', {
        operation: 'auto-attendance',
        eventId: slot.event.id,
        metadata: {
          slotId: slot.id,
          eventName: slot.event.name,
          participants: participants.length,
          attended: matches.filter(m => m.attended).length,
          noShow: matches.filter(m => !m.attended).length,
        },
      });
    } catch (err) {
      cronLogger.error('Error processing slot for auto-attendance', {
        operation: 'auto-attendance',
        eventId: slot.event.id,
      }, err as Error);
      errors.push(`Slot ${slot.id}: ${(err as Error).message}`);
    }
  }

  cronLogger.info('Auto-attendance cron completed', {
    operation: 'auto-attendance',
    metadata: {
      slotsProcessed,
      bookingsMarkedAttended,
      bookingsMarkedNoShow,
      errors: errors.length,
    },
  });

  return NextResponse.json({
    success: true,
    slotsProcessed,
    bookingsMarkedAttended,
    bookingsMarkedNoShow,
    errors: errors.length > 0 ? errors : undefined,
  });
}
