// Backfill co-hosts to existing webinar calendar events
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Google Calendar API for adding attendees
async function addAttendeeToEvent(accessToken, refreshToken, eventId, attendeeEmail) {
  // First get the current event
  const getResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!getResponse.ok) {
    const error = await getResponse.text();
    throw new Error(`Failed to get event: ${error}`);
  }

  const event = await getResponse.json();

  // Check if attendee already exists
  const existingAttendees = event.attendees || [];
  if (existingAttendees.some(a => a.email === attendeeEmail)) {
    console.log(`  ${attendeeEmail} already on event`);
    return { alreadyExists: true };
  }

  // Add the new attendee
  const updatedAttendees = [...existingAttendees, { email: attendeeEmail }];

  const patchResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attendees: updatedAttendees,
      }),
    }
  );

  if (!patchResponse.ok) {
    const error = await patchResponse.text();
    throw new Error(`Failed to update event: ${error}`);
  }

  return { added: true };
}

async function main() {
  // Get the LiveSchool Office Hours webinar
  const { data: webinar, error: webinarError } = await supabase
    .from('oh_events')
    .select('*')
    .eq('meeting_type', 'webinar')
    .eq('is_active', true)
    .eq('slug', 'liveschool-office-hours')
    .single();

  if (webinarError || !webinar) {
    console.log('No webinar found:', webinarError);
    return;
  }

  // Get the owner's admin record separately
  const { data: ownerAdmin } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('id', webinar.host_id)
    .single();

  console.log(`\nEvent: ${webinar.name}`);
  console.log(`Owner: ${ownerAdmin?.email}`);

  // Get ALL hosts (including backup role)
  const { data: eventHosts } = await supabase
    .from('oh_event_hosts')
    .select('admin_id, role')
    .eq('event_id', webinar.id);

  if (!eventHosts || eventHosts.length === 0) {
    console.log('No co-hosts found');
    return;
  }

  // Get co-host emails
  const hostIds = eventHosts.map(h => h.admin_id);
  const { data: admins } = await supabase
    .from('oh_admins')
    .select('id, email')
    .in('id', hostIds);

  console.log('\nCo-hosts to add:');
  for (const host of eventHosts) {
    const admin = admins?.find(a => a.id === host.admin_id);
    console.log(`  - ${admin?.email} (${host.role})`);
  }

  // Get owner's tokens
  if (!ownerAdmin?.google_access_token) {
    console.log('\nOwner needs to reconnect Google Calendar');
    return;
  }

  // Get slots with Google Calendar events
  const { data: slots } = await supabase
    .from('oh_slots')
    .select('id, google_event_id, start_time')
    .eq('event_id', webinar.id)
    .not('google_event_id', 'is', null)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  console.log(`\nSlots to process: ${slots?.length || 0}`);

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const slot of slots || []) {
    console.log(`\nSlot: ${new Date(slot.start_time).toLocaleString()}`);

    for (const admin of admins || []) {
      // Skip the owner
      if (admin.email === ownerAdmin.email) continue;

      try {
        const result = await addAttendeeToEvent(
          ownerAdmin.google_access_token,
          ownerAdmin.google_refresh_token,
          slot.google_event_id,
          admin.email
        );

        if (result.alreadyExists) {
          skipped++;
        } else {
          added++;
          console.log(`  Added ${admin.email}`);
        }
      } catch (err) {
        failed++;
        console.log(`  Failed to add ${admin.email}: ${err.message}`);
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Added: ${added}`);
  console.log(`Already existed: ${skipped}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
