import { NextRequest, NextResponse } from 'next/server';
import {
  decryptTokens,
  getMicrosoftFreeBusy,
  refreshMicrosoftToken,
  encryptTokens,
} from '@/lib/microsoft';

// GET - Fetch busy times for the connected calendar
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json(
      { error: 'start and end parameters are required' },
      { status: 400 }
    );
  }

  // Get encrypted tokens from cookie
  const tokenCookie = request.cookies.get('attendee_ms_calendar');
  if (!tokenCookie) {
    return NextResponse.json(
      { error: 'Calendar not connected', connected: false },
      { status: 401 }
    );
  }

  try {
    let tokens = decryptTokens(tokenCookie.value);

    // Check if token is expired or about to expire (within 5 minutes)
    const isExpiringSoon = tokens.expires_at - Date.now() < 5 * 60 * 1000;

    let response: NextResponse;

    if (isExpiringSoon && tokens.refresh_token) {
      // Refresh the token
      try {
        const newTokens = await refreshMicrosoftToken(tokens.refresh_token);
        const expiresAt = Date.now() + newTokens.expires_in * 1000;

        tokens = {
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token || tokens.refresh_token,
          expires_at: expiresAt,
          email: tokens.email,
        };

        // We'll set the updated cookie in the response
      } catch (refreshError) {
        console.error('Failed to refresh Microsoft token:', refreshError);
        return NextResponse.json(
          { error: 'Session expired. Please reconnect your calendar.', connected: false },
          { status: 401 }
        );
      }
    }

    // Fetch busy times from Microsoft Graph
    const busyBlocks = await getMicrosoftFreeBusy(tokens.access_token, start, end);

    response = NextResponse.json({
      busy: busyBlocks,
      email: tokens.email,
      connected: true,
    });

    // If we refreshed the token, update the cookie
    if (isExpiringSoon && tokens.refresh_token) {
      const encryptedTokens = encryptTokens(tokens);
      response.cookies.set('attendee_ms_calendar', encryptedTokens, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    return response;
  } catch (err) {
    console.error('Error fetching busy times:', err);

    // If the error is an auth error, clear the cookie
    if (err instanceof Error && err.message.includes('401')) {
      const response = NextResponse.json(
        { error: 'Session expired. Please reconnect your calendar.', connected: false },
        { status: 401 }
      );
      response.cookies.delete('attendee_ms_calendar');
      return response;
    }

    return NextResponse.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    );
  }
}
