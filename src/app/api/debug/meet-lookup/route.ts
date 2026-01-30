import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { refreshAccessToken } from '@/lib/google';

// Debug endpoint to test Google Meet API lookup
// GET /api/debug/meet-lookup?meetCode=sry-kexy-wrd
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const meetCode = request.nextUrl.searchParams.get('meetCode');
  if (!meetCode) {
    return NextResponse.json({ error: 'meetCode parameter required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Get current user's Google credentials (session IS the admin object)
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('google_access_token, google_refresh_token, email')
    .eq('id', session.id)
    .single();

  if (!admin?.google_refresh_token) {
    return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
  }

  // Refresh the token
  let accessToken = admin.google_access_token;
  try {
    const refreshed = await refreshAccessToken(admin.google_refresh_token);
    if (refreshed.access_token) {
      accessToken = refreshed.access_token;
    }
  } catch (err) {
    return NextResponse.json({
      error: 'Failed to refresh token',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 400 });
  }

  const meetApiBase = 'https://meet.googleapis.com/v2';
  const results: Record<string, unknown> = {
    meetCode,
    adminEmail: admin.email,
    queries: [],
  };

  // Try different query approaches
  const queries = [
    // Approach 1: Filter by space.name with the meet code
    {
      name: 'space.name filter (lowercase)',
      url: `${meetApiBase}/conferenceRecords?filter=space.name="spaces/${meetCode.toLowerCase()}"`,
    },
    // Approach 2: Try without the spaces/ prefix
    {
      name: 'space.meeting_code filter',
      url: `${meetApiBase}/conferenceRecords?filter=space.meeting_code="${meetCode.toLowerCase()}"`,
    },
    // Approach 3: List all recent conference records (no filter)
    {
      name: 'all recent records (no filter)',
      url: `${meetApiBase}/conferenceRecords`,
    },
  ];

  for (const query of queries) {
    try {
      const response = await fetch(query.url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      (results.queries as Array<unknown>).push({
        name: query.name,
        url: query.url,
        status: response.status,
        ok: response.ok,
        data: responseData,
      });
    } catch (err) {
      (results.queries as Array<unknown>).push({
        name: query.name,
        url: query.url,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json(results);
}
