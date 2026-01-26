import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { getContactWithCompany, isHubSpotConnected, getHubSpotConfig, HubSpotEnrichedContact } from '@/lib/hubspot';

interface CachedContactData {
  hubspot: HubSpotEnrichedContact | null;
  sessionHistory: {
    totalSessions: number;
    attendedCount: number;
    previousTopics: string[];
    firstSession: string | null;
    lastSession: string | null;
  };
}

// Simple in-memory cache for HubSpot contact data
const cache = new Map<string, { data: CachedContactData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// GET HubSpot enriched contact data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email } = await params;
  const decodedEmail = decodeURIComponent(email).toLowerCase();

  // Check if HubSpot is connected and get config
  const hubspotConfig = await getHubSpotConfig();
  const hubspotConnected = hubspotConfig ? await isHubSpotConnected() : false;
  if (!hubspotConnected || !hubspotConfig) {
    return NextResponse.json({
      connected: false,
      message: 'HubSpot not connected',
    });
  }

  const portalId = hubspotConfig.portal_id;

  // Check cache first
  const cacheKey = `hubspot:${decodedEmail}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({
      connected: true,
      fromCache: true,
      portalId,
      ...cached.data,
    });
  }

  // Get HubSpot enriched data
  const hubspotData = await getContactWithCompany(decodedEmail);

  // Get local session history
  const supabase = getServiceSupabase();
  const { data: bookings } = await supabase
    .from('oh_bookings')
    .select(`
      id,
      question_responses,
      attended_at,
      created_at,
      slot:oh_slots(
        start_time,
        event:oh_events(name)
      )
    `)
    .eq('email', decodedEmail)
    .is('cancelled_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  // Extract previous questions/topics
  const previousTopics: string[] = [];
  for (const booking of bookings || []) {
    if (booking.question_responses) {
      const responses = Object.values(booking.question_responses);
      for (const response of responses) {
        if (typeof response === 'string' && response.trim()) {
          previousTopics.push(response.slice(0, 100)); // Limit length
        }
      }
    }
  }

  // Count attended sessions
  const attendedCount = bookings?.filter((b) => b.attended_at).length || 0;
  const totalSessions = bookings?.length || 0;

  const result = {
    hubspot: hubspotData,
    sessionHistory: {
      totalSessions,
      attendedCount,
      previousTopics: previousTopics.slice(0, 5), // Last 5 topics
      firstSession: bookings?.length
        ? bookings[bookings.length - 1].created_at
        : null,
      lastSession: bookings?.length ? bookings[0].created_at : null,
    },
  };

  // Cache the result
  cache.set(cacheKey, { data: result, timestamp: Date.now() });

  return NextResponse.json({
    connected: true,
    fromCache: false,
    portalId,
    ...result,
  });
}
