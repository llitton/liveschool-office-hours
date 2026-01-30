import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { refreshAccessToken } from '@/lib/google';

// Debug endpoint to see participant data from a Google Meet
// GET /api/debug/meet-participants?meetCode=sry-kexy-wrd
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

  // Get current user's Google credentials
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

  // Step 1: Find the conference record
  const conferenceUrl = `${meetApiBase}/conferenceRecords?filter=space.meeting_code="${meetCode.toLowerCase()}"`;
  const conferenceResponse = await fetch(conferenceUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!conferenceResponse.ok) {
    return NextResponse.json({
      error: 'Failed to fetch conference records',
      status: conferenceResponse.status,
    });
  }

  const conferenceData = await conferenceResponse.json();
  const records = conferenceData.conferenceRecords || [];

  if (records.length === 0) {
    return NextResponse.json({
      error: 'No conference records found',
      meetCode,
    });
  }

  // Step 2: Get participants for each conference record
  const results = [];
  for (const record of records) {
    const participantsUrl = `${meetApiBase}/${record.name}/participants`;
    const participantsResponse = await fetch(participantsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    let participants = [];
    if (participantsResponse.ok) {
      const participantsData = await participantsResponse.json();
      participants = participantsData.participants || [];
    }

    results.push({
      conferenceRecord: record,
      participantCount: participants.length,
      participants: participants.map((p: Record<string, unknown>) => ({
        // Include all the raw data so we can see what's available
        raw: p,
        // Also extract the key fields we use for matching
        email: (p.signedinUser as Record<string, unknown>)?.user || null,
        displayName: (p.signedinUser as Record<string, unknown>)?.displayName ||
                     (p.anonymousUser as Record<string, unknown>)?.displayName || 'Unknown',
        earliestStartTime: p.earliestStartTime,
        latestEndTime: p.latestEndTime,
      })),
    });
  }

  return NextResponse.json({
    meetCode,
    adminEmail: admin.email,
    conferenceRecordsFound: records.length,
    results,
  });
}
