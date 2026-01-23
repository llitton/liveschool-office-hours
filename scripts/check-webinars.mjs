// Check webinar events and their co-hosts
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

async function main() {
  // Get all webinar events
  const { data: webinars } = await supabase
    .from('oh_events')
    .select('id, name, slug, host_email, created_at')
    .eq('meeting_type', 'webinar')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  console.log('\n=== Webinar Events ===\n');

  for (const webinar of webinars || []) {
    console.log(`Event: ${webinar.name}`);
    console.log(`  Slug: ${webinar.slug}`);
    console.log(`  Owner: ${webinar.host_email}`);
    console.log(`  Created: ${new Date(webinar.created_at).toLocaleString()}`);

    // Get co-hosts from oh_event_hosts
    const { data: hosts } = await supabase
      .from('oh_event_hosts')
      .select('admin_id, role')
      .eq('event_id', webinar.id);

    if (hosts && hosts.length > 0) {
      const hostIds = hosts.map(h => h.admin_id);
      const { data: admins } = await supabase
        .from('oh_admins')
        .select('id, email')
        .in('id', hostIds);

      console.log(`  Co-hosts (oh_event_hosts):`);
      for (const host of hosts) {
        const admin = admins?.find(a => a.id === host.admin_id);
        console.log(`    - ${admin?.email || host.admin_id} (${host.role})`);
      }
    } else {
      console.log(`  Co-hosts: NONE configured in oh_event_hosts`);
    }

    // Get recent slots
    const { data: slots, count } = await supabase
      .from('oh_slots')
      .select('id, google_event_id, start_time', { count: 'exact' })
      .eq('event_id', webinar.id)
      .order('created_at', { ascending: false })
      .limit(3);

    console.log(`  Slots: ${count || 0} total`);
    if (slots && slots.length > 0) {
      console.log(`  Recent slots:`);
      for (const slot of slots) {
        console.log(`    - ${new Date(slot.start_time).toLocaleString()}`);
        console.log(`      Calendar Event: ${slot.google_event_id ? 'YES' : 'NO'}`);
      }
    }
    console.log('');
  }
}

main().catch(console.error);
