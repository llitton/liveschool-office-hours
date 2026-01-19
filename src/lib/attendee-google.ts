import crypto from 'crypto';

// Google OAuth configuration for attendees (simpler than host OAuth)
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface GoogleUser {
  email: string;
  name?: string;
}

export interface BusyTimeBlock {
  start: string;
  end: string;
}

/**
 * Generate Google OAuth authorization URL for attendees
 */
export function getGoogleAttendeeAuthUrl(state?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/attendee-calendar/google`;

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    ...(state && { state }),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function getGoogleAttendeeTokens(code: string): Promise<GoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/attendee-calendar/google`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token
 */
export async function refreshGoogleAttendeeToken(refreshToken: string): Promise<GoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return response.json();
}

/**
 * Get user info from Google
 */
export async function getGoogleAttendeeUserInfo(accessToken: string): Promise<GoogleUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user info: ${error}`);
  }

  return response.json();
}

/**
 * Get free/busy times from Google Calendar
 */
export async function getGoogleAttendeeFreeBusy(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<BusyTimeBlock[]> {
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/freeBusy',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: 'primary' }],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get calendar events: ${error}`);
  }

  const data = await response.json();
  const busyTimes = data.calendars?.primary?.busy || [];

  return busyTimes.map((block: { start: string; end: string }) => ({
    start: block.start,
    end: block.end,
  }));
}

// --- Cookie encryption utilities (shared with Microsoft) ---

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ATTENDEE_CALENDAR_SECRET;
  if (!secret) {
    throw new Error('ATTENDEE_CALENDAR_SECRET is not set');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt tokens for storage in cookie
 */
export function encryptGoogleTokens(tokens: {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  email: string;
}): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(tokens);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64url');
}

/**
 * Decrypt tokens from cookie
 */
export function decryptGoogleTokens(encryptedData: string): {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  email: string;
} {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64url');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}
