import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isHubSpotConnected, getHubSpotConfig } from '@/lib/hubspot';

// Simple in-memory cache for user types
const cache = new Map<string, { userType: string | null; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Batch fetch user types from HubSpot for multiple emails
 * POST /api/attendees/batch-types
 * Body: { emails: string[] }
 * Returns: { [email]: userType | null }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { emails } = await request.json();
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'emails array required' }, { status: 400 });
  }

  // Check if HubSpot is connected
  const hubspotConfig = await getHubSpotConfig();
  const hubspotConnected = hubspotConfig ? await isHubSpotConnected() : false;
  if (!hubspotConnected || !hubspotConfig) {
    return NextResponse.json({ connected: false, userTypes: {} });
  }

  const result: Record<string, string | null> = {};
  const emailsToFetch: string[] = [];

  // Check cache first
  for (const email of emails) {
    const normalizedEmail = email.toLowerCase();
    const cached = cache.get(normalizedEmail);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      result[normalizedEmail] = cached.userType;
    } else {
      emailsToFetch.push(normalizedEmail);
    }
  }

  // Batch fetch from HubSpot if we have uncached emails
  if (emailsToFetch.length > 0) {
    try {
      // Use HubSpot batch read API
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubspotConfig.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'email',
                  operator: 'IN',
                  values: emailsToFetch,
                },
              ],
            },
          ],
          properties: ['email', 'user_type', 'user_type__liveschool_', 'jobtitle'],
          limit: 100,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const contacts = data.results || [];

        // Map contacts to emails
        for (const contact of contacts) {
          const email = contact.properties.email?.toLowerCase();
          if (email) {
            const userType = contact.properties.user_type ||
                           contact.properties.user_type__liveschool_ ||
                           contact.properties.jobtitle ||
                           null;
            result[email] = userType;
            cache.set(email, { userType, timestamp: Date.now() });
          }
        }

        // Mark emails not found as null
        for (const email of emailsToFetch) {
          if (!(email in result)) {
            result[email] = null;
            cache.set(email, { userType: null, timestamp: Date.now() });
          }
        }
      }
    } catch (error) {
      console.error('Failed to batch fetch user types:', error);
      // Return what we have from cache
      for (const email of emailsToFetch) {
        result[email] = null;
      }
    }
  }

  return NextResponse.json({ connected: true, userTypes: result });
}
