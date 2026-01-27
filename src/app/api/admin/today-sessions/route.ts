import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getContactWithCompany, isHubSpotConnected } from '@/lib/hubspot';
import { startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface AttendeeWithContext {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  sms_reminder_24h_sent_at: string | null;
  sms_reminder_1h_sent_at: string | null;
  sms_consent: boolean;
  attended_at: string | null;
  no_show_at: string | null;
  cancelled_at: string | null;
  question_responses: Record<string, string> | null;
  company: string | null;
  isFirstTime: boolean;
}

interface TodaySession {
  id: string;
  start_time: string;
  end_time: string;
  google_meet_link: string | null;
  event: {
    id: string;
    name: string;
    slug: string;
    max_attendees: number;
  };
  attendees: AttendeeWithContext[];
  isPast: boolean;
}

// GET today's sessions with attendee details
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const now = new Date();

  // Use Eastern Time for "today" boundaries (consistent with the app)
  const timezone = 'America/New_York';
  const zonedNow = toZonedTime(now, timezone);
  const todayStart = startOfDay(zonedNow);
  const todayEnd = endOfDay(zonedNow);

  // Get current admin's ID
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  // Get events where user is primary host or co-host
  const { data: hostedEvents } = await supabase
    .from('oh_events')
    .select('id')
    .eq('host_id', admin.id);

  const { data: coHostedEvents } = await supabase
    .from('oh_event_hosts')
    .select('event_id')
    .eq('admin_id', admin.id);

  // Combine event IDs
  const eventIds = new Set<string>();
  hostedEvents?.forEach(e => eventIds.add(e.id));
  coHostedEvents?.forEach(e => eventIds.add(e.event_id));

  if (eventIds.size === 0) {
    return NextResponse.json({ sessions: [], hubspotConnected: false });
  }

  // Get slots for today for the user's events
  const { data: slots, error: slotsError } = await supabase
    .from('oh_slots')
    .select(`
      id,
      start_time,
      end_time,
      google_meet_link,
      event:oh_events(id, name, slug, max_attendees),
      bookings:oh_bookings(
        id,
        first_name,
        last_name,
        email,
        reminder_24h_sent_at,
        reminder_1h_sent_at,
        sms_reminder_24h_sent_at,
        sms_reminder_1h_sent_at,
        sms_consent,
        attended_at,
        no_show_at,
        cancelled_at,
        question_responses
      )
    `)
    .eq('is_cancelled', false)
    .in('event_id', Array.from(eventIds))
    .gte('start_time', todayStart.toISOString())
    .lt('start_time', todayEnd.toISOString())
    .order('start_time', { ascending: true });

  if (slotsError) {
    console.error('Error fetching today sessions:', slotsError);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }

  if (!slots || slots.length === 0) {
    return NextResponse.json({ sessions: [], hubspotConnected: false });
  }

  // Check if HubSpot is connected
  const hubspotConnected = await isHubSpotConnected();

  // Collect all unique emails for batch HubSpot lookup
  const allEmails = new Set<string>();
  for (const slot of slots) {
    const bookings = slot.bookings as Array<{ email: string; cancelled_at: string | null }> || [];
    for (const booking of bookings) {
      if (!booking.cancelled_at) {
        allEmails.add(booking.email.toLowerCase());
      }
    }
  }

  // Batch fetch HubSpot data for all attendees
  const hubspotData: Record<string, { company: string | null }> = {};
  if (hubspotConnected && allEmails.size > 0) {
    // Fetch in parallel, limit concurrency
    const emailArray = Array.from(allEmails);
    const batchSize = 5;

    for (let i = 0; i < emailArray.length; i += batchSize) {
      const batch = emailArray.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (email) => {
          try {
            const contact = await getContactWithCompany(email);
            return { email, company: contact?.company?.name || null };
          } catch {
            return { email, company: null };
          }
        })
      );
      for (const result of results) {
        hubspotData[result.email] = { company: result.company };
      }
    }
  }

  // Check first-time attendees (have they booked before today?)
  const firstTimeStatus: Record<string, boolean> = {};
  if (allEmails.size > 0) {
    const { data: previousBookings } = await supabase
      .from('oh_bookings')
      .select('email')
      .in('email', Array.from(allEmails))
      .lt('created_at', todayStart.toISOString())
      .is('cancelled_at', null);

    const returningEmails = new Set(previousBookings?.map(b => b.email.toLowerCase()) || []);
    for (const email of allEmails) {
      firstTimeStatus[email] = !returningEmails.has(email);
    }
  }

  // Build response
  const sessions: TodaySession[] = slots.map((slot) => {
    const eventData = slot.event as unknown as { id: string; name: string; slug: string; max_attendees: number };
    const event = eventData;
    const bookings = (slot.bookings as Array<{
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      reminder_24h_sent_at: string | null;
      reminder_1h_sent_at: string | null;
      sms_reminder_24h_sent_at: string | null;
      sms_reminder_1h_sent_at: string | null;
      sms_consent: boolean;
      attended_at: string | null;
      no_show_at: string | null;
      cancelled_at: string | null;
      question_responses: Record<string, string> | null;
    }>) || [];

    // Filter out cancelled bookings and enrich with context
    const attendees: AttendeeWithContext[] = bookings
      .filter((b) => !b.cancelled_at)
      .map((booking) => ({
        ...booking,
        company: hubspotData[booking.email.toLowerCase()]?.company || null,
        isFirstTime: firstTimeStatus[booking.email.toLowerCase()] ?? true,
      }));

    return {
      id: slot.id,
      start_time: slot.start_time,
      end_time: slot.end_time,
      google_meet_link: slot.google_meet_link,
      event,
      attendees,
      isPast: new Date(slot.end_time) < now,
    };
  });

  return NextResponse.json({
    sessions,
    hubspotConnected,
  });
}
