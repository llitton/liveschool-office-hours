import { NextRequest, NextResponse } from 'next/server';
import {
  getGoogleAttendeeAuthUrl,
  getGoogleAttendeeTokens,
  getGoogleAttendeeUserInfo,
  encryptGoogleTokens,
  decryptGoogleTokens,
  getGoogleAttendeeFreeBusy,
  refreshGoogleAttendeeToken,
} from '@/lib/attendee-google';

// GET - Handle OAuth callback OR initiate OAuth OR get busy times
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const action = searchParams.get('action');

  // Check for busy times request
  if (action === 'busy') {
    return handleBusyRequest(request);
  }

  // Check for status request
  if (action === 'status') {
    return handleStatusRequest(request);
  }

  // If no code, this is initiating OAuth - redirect to Google
  if (!code && !error) {
    const state = searchParams.get('state') || '';
    const authUrl = getGoogleAttendeeAuthUrl(state);
    return NextResponse.redirect(authUrl);
  }

  // Handle OAuth errors
  if (error) {
    const errorDescription = searchParams.get('error_description') || 'Authentication failed';
    return new NextResponse(
      getPopupCloseScript({ success: false, error: errorDescription }),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await getGoogleAttendeeTokens(code!);

    // Get user info to display email
    const userInfo = await getGoogleAttendeeUserInfo(tokens.access_token);

    // Calculate expiration time
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    // Encrypt tokens for cookie storage
    const encryptedTokens = encryptGoogleTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      email: userInfo.email,
    });

    // Create response with HTML that closes popup and notifies parent
    const response = new NextResponse(
      getPopupCloseScript({ success: true, email: userInfo.email, provider: 'google' }),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );

    // Set encrypted token cookie (session-scoped, no maxAge)
    response.cookies.set('attendee_google_calendar', encryptedTokens, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Google OAuth error:', err);
    return new NextResponse(
      getPopupCloseScript({
        success: false,
        error: err instanceof Error ? err.message : 'Authentication failed',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}

// POST - Disconnect Google calendar
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  if (action === 'disconnect') {
    const response = NextResponse.json({ success: true });
    response.cookies.delete('attendee_google_calendar');
    return response;
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

/**
 * Handle busy times request
 */
async function handleBusyRequest(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json(
      { error: 'start and end parameters are required' },
      { status: 400 }
    );
  }

  const tokenCookie = request.cookies.get('attendee_google_calendar');
  if (!tokenCookie) {
    return NextResponse.json(
      { error: 'Calendar not connected', connected: false },
      { status: 401 }
    );
  }

  try {
    let tokens = decryptGoogleTokens(tokenCookie.value);

    // Check if token is expired or about to expire (within 5 minutes)
    const isExpiringSoon = tokens.expires_at - Date.now() < 5 * 60 * 1000;

    let response: NextResponse;

    if (isExpiringSoon && tokens.refresh_token) {
      try {
        const newTokens = await refreshGoogleAttendeeToken(tokens.refresh_token);
        const expiresAt = Date.now() + newTokens.expires_in * 1000;

        tokens = {
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token || tokens.refresh_token,
          expires_at: expiresAt,
          email: tokens.email,
        };
      } catch (refreshError) {
        console.error('Failed to refresh Google token:', refreshError);
        return NextResponse.json(
          { error: 'Session expired. Please reconnect your calendar.', connected: false },
          { status: 401 }
        );
      }
    }

    // Fetch busy times from Google Calendar
    const busyBlocks = await getGoogleAttendeeFreeBusy(tokens.access_token, start, end);

    response = NextResponse.json({
      busy: busyBlocks,
      email: tokens.email,
      connected: true,
      provider: 'google',
    });

    // If we refreshed the token, update the cookie
    if (isExpiringSoon && tokens.refresh_token) {
      const encryptedTokens = encryptGoogleTokens(tokens);
      response.cookies.set('attendee_google_calendar', encryptedTokens, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    return response;
  } catch (err) {
    console.error('Error fetching busy times:', err);

    if (err instanceof Error && err.message.includes('401')) {
      const response = NextResponse.json(
        { error: 'Session expired. Please reconnect your calendar.', connected: false },
        { status: 401 }
      );
      response.cookies.delete('attendee_google_calendar');
      return response;
    }

    return NextResponse.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    );
  }
}

/**
 * Handle status request
 */
async function handleStatusRequest(request: NextRequest) {
  const tokenCookie = request.cookies.get('attendee_google_calendar');

  if (!tokenCookie) {
    return NextResponse.json({ connected: false, provider: 'google' });
  }

  try {
    const tokens = decryptGoogleTokens(tokenCookie.value);

    if (tokens.expires_at < Date.now()) {
      return NextResponse.json({
        connected: true,
        email: tokens.email,
        provider: 'google',
        needsRefresh: true,
      });
    }

    return NextResponse.json({
      connected: true,
      email: tokens.email,
      provider: 'google',
    });
  } catch (err) {
    console.error('Error decrypting calendar token:', err);
    const response = NextResponse.json({ connected: false, provider: 'google' });
    response.cookies.delete('attendee_google_calendar');
    return response;
  }
}

/**
 * Generate HTML/JS that closes the popup and notifies the parent window
 */
function getPopupCloseScript(result: {
  success: boolean;
  email?: string;
  error?: string;
  provider?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Connecting Calendar...</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f6f6f9;
    }
    .message {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e5e5e5;
      border-top-color: #4285f4;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="message">
    <div class="spinner"></div>
    <p>${result.success ? 'Calendar connected!' : 'Connection failed'}</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage(${JSON.stringify({
        type: 'google-calendar-auth',
        ...result,
      })}, '*');
    }
    setTimeout(() => window.close(), 1000);
  </script>
</body>
</html>
`;
}
