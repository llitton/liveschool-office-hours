import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { addAttendeeToEvent } from '@/lib/google';
import { getParticipatingHosts } from '@/lib/round-robin';

// POST /api/slots/add-cohosts
// Add co-hosts to existing calendar events for webinar/collective event slots
export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const { event_id } = await request.json();

  if (!event_id) {
    return NextResponse.json({ error: 'event_id is required' }, { status: 400 });
  }

  // Get the event and verify it's a webinar or collective
  const { data: event, error: eventError } = await supabase
    .from('oh_events')
    .select('*, oh_admins!oh_events_admin_id_fkey(*)')
    .eq('id', event_id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  if (event.meeting_type !== 'webinar' && event.meeting_type !== 'collective') {
    return NextResponse.json({
      error: 'This operation is only for webinar and collective events'
    }, { status: 400 });
  }

  // Get participating hosts
  const participatingHosts = await getParticipatingHosts(event_id);

  if (participatingHosts.length === 0) {
    return NextResponse.json({ error: 'No co-hosts found for this event' }, { status: 400 });
  }

  // Get co-host emails
  const { data: coHosts } = await supabase
    .from('oh_admins')
    .select('id, email')
    .in('id', participatingHosts);

  if (!coHosts || coHosts.length === 0) {
    return NextResponse.json({ error: 'Could not fetch co-host information' }, { status: 500 });
  }

  // Get the primary host's tokens (event owner)
  const hostAdmin = event.oh_admins;
  if (!hostAdmin?.google_access_token || !hostAdmin?.google_refresh_token) {
    return NextResponse.json({
      error: 'Event owner must have Google Calendar connected'
    }, { status: 400 });
  }

  // Get all slots for this event that have a Google event ID
  const { data: slots, error: slotsError } = await supabase
    .from('oh_slots')
    .select('id, google_event_id, start_time')
    .eq('event_id', event_id)
    .not('google_event_id', 'is', null)
    .order('start_time', { ascending: true });

  if (slotsError) {
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
  }

  if (!slots || slots.length === 0) {
    return NextResponse.json({
      error: 'No slots with calendar events found',
      message: 'Slots may not have been created with Google Calendar integration'
    }, { status: 404 });
  }

  // Add each co-host to each calendar event
  const results: {
    success: number;
    failed: number;
    errors: string[];
    details: Array<{ slotId: string; coHost: string; status: string }>;
  } = {
    success: 0,
    failed: 0,
    errors: [],
    details: [],
  };

  for (const slot of slots) {
    if (!slot.google_event_id) continue;

    for (const coHost of coHosts) {
      // Skip the event owner (they're already on the event)
      if (coHost.email === hostAdmin.email) {
        continue;
      }

      try {
        await addAttendeeToEvent(
          hostAdmin.google_access_token,
          hostAdmin.google_refresh_token,
          slot.google_event_id,
          coHost.email
        );
        results.success++;
        results.details.push({
          slotId: slot.id,
          coHost: coHost.email,
          status: 'added',
        });
      } catch (err) {
        results.failed++;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        results.errors.push(`Slot ${slot.id} / ${coHost.email}: ${errorMsg}`);
        results.details.push({
          slotId: slot.id,
          coHost: coHost.email,
          status: `failed: ${errorMsg}`,
        });
      }
    }
  }

  return NextResponse.json({
    message: `Added co-hosts to calendar events`,
    slotsProcessed: slots.length,
    coHostsAdded: results.success,
    failed: results.failed,
    errors: results.errors.length > 0 ? results.errors : undefined,
  });
}
