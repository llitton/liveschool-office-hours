import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { getContactWithCompany, isHubSpotConnected, getHubSpotConfig, HubSpotEnrichedContact } from '@/lib/hubspot';

interface SessionHistory {
  totalSessions: number;
  attendedCount: number;
  previousTopics: string[];
  firstSession: string | null;
  lastSession: string | null;
}

interface ContactData {
  hubspot: HubSpotEnrichedContact | null;
  sessionHistory: SessionHistory;
}

interface CachedContact {
  data: ContactData;
  timestamp: number;
}

// In-memory cache for batch context data
const cache = new Map<string, CachedContact>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Batch fetch HubSpot context for multiple attendees
 * This is more efficient than individual calls when expanding attendee lists
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let emails: string[];
  try {
    const body = await request.json();
    emails = body.emails;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'emails array required' }, { status: 400 });
  }

  // Check HubSpot connection
  const hubspotConfig = await getHubSpotConfig();
  const hubspotConnected = hubspotConfig ? await isHubSpotConnected() : false;

  if (!hubspotConnected || !hubspotConfig) {
    return NextResponse.json({
      connected: false,
      contacts: {},
    });
  }

  const portalId = hubspotConfig.portal_id;
  const normalizedEmails = emails.map(e => e.toLowerCase().trim());
  const result: Record<string, ContactData> = {};
  const emailsToFetch: string[] = [];

  // Check cache first
  for (const email of normalizedEmails) {
    const cached = cache.get(email);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      result[email] = cached.data;
    } else {
      emailsToFetch.push(email);
    }
  }

  // If all emails are cached, return early
  if (emailsToFetch.length === 0) {
    return NextResponse.json({
      connected: true,
      portalId,
      contacts: result,
    });
  }

  // Fetch session history only for uncached emails
  const supabase = getServiceSupabase();
  const { data: allBookings } = await supabase
    .from('oh_bookings')
    .select(`
      id,
      email,
      question_responses,
      attended_at,
      created_at,
      slot:oh_slots(
        start_time,
        event:oh_events(name)
      )
    `)
    .in('email', emailsToFetch)
    .is('cancelled_at', null)
    .order('created_at', { ascending: false });

  // Group bookings by email
  const bookingsByEmail: Record<string, typeof allBookings> = {};
  for (const booking of allBookings || []) {
    const email = booking.email.toLowerCase();
    if (!bookingsByEmail[email]) {
      bookingsByEmail[email] = [];
    }
    bookingsByEmail[email].push(booking);
  }

  // Process session history for uncached emails only
  const now = new Date();
  const sessionHistoryByEmail: Record<string, SessionHistory> = {};

  for (const email of emailsToFetch) {
    const bookings = bookingsByEmail[email] || [];
    const pastBookings: typeof bookings = [];

    for (const booking of bookings) {
      const slot = booking.slot as unknown as { start_time: string; event: { name: string } } | null;
      const slotStartTime = slot?.start_time;
      if (slotStartTime && new Date(slotStartTime) < now) {
        pastBookings.push(booking);
      }
    }

    // Extract topics from past sessions only
    const previousTopics: string[] = [];
    for (const booking of pastBookings) {
      if (booking.question_responses) {
        const responses = Object.values(booking.question_responses);
        for (const response of responses) {
          if (typeof response === 'string' && response.trim()) {
            previousTopics.push(response.slice(0, 100));
          }
        }
      }
    }

    sessionHistoryByEmail[email] = {
      totalSessions: pastBookings.length,
      attendedCount: pastBookings.filter(b => b.attended_at).length,
      previousTopics: previousTopics.slice(0, 5),
      firstSession: bookings.length ? bookings[bookings.length - 1].created_at : null,
      lastSession: bookings.length ? bookings[0].created_at : null,
    };
  }

  // Fetch HubSpot data for uncached emails (in parallel but with concurrency limit)
  const CONCURRENCY_LIMIT = 5;
  for (let i = 0; i < emailsToFetch.length; i += CONCURRENCY_LIMIT) {
    const batch = emailsToFetch.slice(i, i + CONCURRENCY_LIMIT);
    const hubspotResults = await Promise.all(
      batch.map(async (email) => {
        try {
          const hubspotData = await getContactWithCompany(email);
          return { email, hubspotData };
        } catch (err) {
          console.error(`Failed to fetch HubSpot data for ${email}:`, err);
          return { email, hubspotData: null };
        }
      })
    );

    for (const { email, hubspotData } of hubspotResults) {
      const contactData: ContactData = {
        hubspot: hubspotData,
        sessionHistory: sessionHistoryByEmail[email] || {
          totalSessions: 0,
          attendedCount: 0,
          previousTopics: [],
          firstSession: null,
          lastSession: null,
        },
      };

      // Cache the result
      cache.set(email, { data: contactData, timestamp: Date.now() });
      result[email] = contactData;
    }
  }

  return NextResponse.json({
    connected: true,
    portalId,
    contacts: result,
  });
}
