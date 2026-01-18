import crypto from 'crypto';

// Microsoft OAuth configuration
const MICROSOFT_SCOPES = ['Calendars.Read', 'User.Read', 'offline_access'];
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com';
const MICROSOFT_GRAPH_URL = 'https://graph.microsoft.com/v1.0';

interface MicrosoftTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface MicrosoftUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
}

export interface BusyTimeBlock {
  start: string;
  end: string;
}

/**
 * Generate Microsoft OAuth authorization URL
 */
export function getMicrosoftAuthUrl(state?: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/attendee-calendar/auth`;
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';

  const params = new URLSearchParams({
    client_id: clientId!,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: MICROSOFT_SCOPES.join(' '),
    response_mode: 'query',
    prompt: 'select_account',
    ...(state && { state }),
  });

  return `${MICROSOFT_AUTH_URL}/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function getMicrosoftTokensFromCode(code: string): Promise<MicrosoftTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/attendee-calendar/auth`;
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';

  const response = await fetch(`${MICROSOFT_AUTH_URL}/${tenant}/oauth2/v2.0/token`, {
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
export async function refreshMicrosoftToken(refreshToken: string): Promise<MicrosoftTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';

  const response = await fetch(`${MICROSOFT_AUTH_URL}/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: MICROSOFT_SCOPES.join(' '),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return response.json();
}

/**
 * Get user info from Microsoft Graph
 */
export async function getMicrosoftUserInfo(accessToken: string): Promise<MicrosoftUser> {
  const response = await fetch(`${MICROSOFT_GRAPH_URL}/me`, {
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
 * Get free/busy times from Microsoft Graph
 * Uses the calendarView endpoint to get events in a time range
 */
export async function getMicrosoftFreeBusy(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<BusyTimeBlock[]> {
  // Use calendarView to get events in the time range
  const params = new URLSearchParams({
    startDateTime: timeMin,
    endDateTime: timeMax,
    $select: 'start,end,showAs',
    $top: '100', // Limit to 100 events
  });

  const response = await fetch(
    `${MICROSOFT_GRAPH_URL}/me/calendarView?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get calendar events: ${error}`);
  }

  const data = await response.json();
  const events = data.value || [];

  // Filter to only busy events (not free, tentative, or working elsewhere)
  // showAs values: free, tentative, busy, oof (out of office), workingElsewhere
  const busyBlocks: BusyTimeBlock[] = events
    .filter((event: { showAs?: string }) =>
      event.showAs === 'busy' || event.showAs === 'oof' || !event.showAs
    )
    .map((event: { start: { dateTime: string }; end: { dateTime: string } }) => ({
      start: event.start.dateTime.endsWith('Z')
        ? event.start.dateTime
        : event.start.dateTime + 'Z',
      end: event.end.dateTime.endsWith('Z')
        ? event.end.dateTime
        : event.end.dateTime + 'Z',
    }));

  return busyBlocks;
}

// --- Cookie encryption utilities ---

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ATTENDEE_CALENDAR_SECRET;
  if (!secret) {
    throw new Error('ATTENDEE_CALENDAR_SECRET is not set');
  }
  // Use SHA-256 to derive a 32-byte key from the secret
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt tokens for storage in cookie
 */
export function encryptTokens(tokens: {
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

  // Combine IV + authTag + encrypted data
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64url');
}

/**
 * Decrypt tokens from cookie
 */
export function decryptTokens(encryptedData: string): {
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
