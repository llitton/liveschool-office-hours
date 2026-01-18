import { NextRequest, NextResponse } from 'next/server';
import {
  getMicrosoftAuthUrl,
  getMicrosoftTokensFromCode,
  getMicrosoftUserInfo,
  encryptTokens,
} from '@/lib/microsoft';

// GET - Handle OAuth callback OR initiate OAuth
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const returnUrl = searchParams.get('return_url');

  // If no code, this is initiating OAuth - redirect to Microsoft
  if (!code && !error) {
    // Store return URL in state parameter
    const state = returnUrl ? Buffer.from(returnUrl).toString('base64url') : '';
    const authUrl = getMicrosoftAuthUrl(state);
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
    const tokens = await getMicrosoftTokensFromCode(code!);

    // Get user info to display email
    const userInfo = await getMicrosoftUserInfo(tokens.access_token);
    const email = userInfo.mail || userInfo.userPrincipalName;

    // Calculate expiration time
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    // Encrypt tokens for cookie storage
    const encryptedTokens = encryptTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      email,
    });

    // Create response with HTML that closes popup and notifies parent
    const response = new NextResponse(
      getPopupCloseScript({ success: true, email }),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );

    // Set encrypted token cookie (session-scoped, no maxAge)
    response.cookies.set('attendee_ms_calendar', encryptedTokens, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Microsoft OAuth error:', err);
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

/**
 * Generate HTML/JS that closes the popup and notifies the parent window
 */
function getPopupCloseScript(result: {
  success: boolean;
  email?: string;
  error?: string;
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
      border-top-color: #6f71ee;
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
    // Notify parent window of the result
    if (window.opener) {
      window.opener.postMessage(${JSON.stringify({
        type: 'microsoft-calendar-auth',
        ...result,
      })}, '*');
    }
    // Close the popup after a brief delay
    setTimeout(() => window.close(), 1000);
  </script>
</body>
</html>
`;
}
