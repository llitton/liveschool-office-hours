import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// GET events for a host by their quick links token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 20) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Find admin by quick links token
  const { data: admin, error: adminError } = await supabase
    .from('oh_admins')
    .select('id, email, name, profile_image')
    .eq('quick_links_token', token)
    .single();

  if (adminError || !admin) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
  }

  // Get all active events where this admin is the host or a co-host
  const { data: ownedEvents, error: eventsError } = await supabase
    .from('oh_events')
    .select('id, slug, name, subtitle, duration_minutes, meeting_type, is_active, max_attendees')
    .eq('host_email', admin.email)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  // Get events where admin is a co-host
  const { data: cohostedEvents } = await supabase
    .from('oh_event_hosts')
    .select(`
      event:oh_events(id, slug, name, subtitle, duration_minutes, meeting_type, is_active, max_attendees)
    `)
    .eq('admin_id', admin.id);

  // Define the event type for clarity
  type EventData = {
    id: string;
    slug: string;
    name: string;
    subtitle: string | null;
    duration_minutes: number;
    meeting_type: string;
    is_active: boolean;
    max_attendees: number;
  };

  // Combine and dedupe events
  const allEvents: EventData[] = [...(ownedEvents || [])];
  const eventIds = new Set(allEvents.map(e => e.id));

  if (cohostedEvents) {
    for (const eh of cohostedEvents) {
      // Handle joined data from Supabase (can be object or null)
      const eventData = eh.event as EventData | EventData[] | null;
      const event = Array.isArray(eventData) ? eventData[0] : eventData;
      if (event && event.is_active && !eventIds.has(event.id)) {
        allEvents.push(event);
        eventIds.add(event.id);
      }
    }
  }

  // Get upcoming slot counts for each event
  const now = new Date().toISOString();
  const eventsWithCounts = await Promise.all(
    allEvents.map(async (event) => {
      const { count } = await supabase
        .from('oh_slots')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('is_cancelled', false)
        .gte('start_time', now);

      return {
        ...event,
        upcoming_slots: count || 0,
      };
    })
  );

  // Build the base URL for booking links
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  return NextResponse.json({
    admin: {
      name: admin.name,
      email: admin.email,
      profile_image: admin.profile_image,
    },
    events: eventsWithCounts.map(event => ({
      ...event,
      booking_url: `${baseUrl}/book/${event.slug}`,
    })),
    base_url: baseUrl,
  });
}
