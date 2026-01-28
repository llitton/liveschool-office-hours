import { google } from 'googleapis';
import { calendarLogger, emailLogger } from './logger';

/**
 * Retry configuration for Google API calls
 * Implements exponential backoff for transient failures
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Check if an error is retryable (transient network/rate limit issues)
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Check for rate limiting (429) or server errors (5xx)
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('too many requests') ||
      message.includes('temporarily unavailable') ||
      message.includes('service unavailable') ||
      message.includes('internal error') ||
      message.includes('backend error') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('socket hang up')
    ) {
      return true;
    }
  }

  // Check for HTTP status codes
  const status = (error as { code?: number; status?: number }).code || (error as { code?: number; status?: number }).status;
  if (status) {
    // Retry on rate limits (429) and server errors (500, 502, 503, 504)
    return status === 429 || (status >= 500 && status <= 504);
  }

  return false;
}

/**
 * Execute a function with exponential backoff retry logic
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  operationName: string = 'Google API call'
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < config.maxRetries && isRetryableError(error)) {
        // Calculate delay with exponential backoff + jitter
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
          config.maxDelayMs
        );

        calendarLogger.warn(
          `${operationName} failed, retrying`,
          {
            operation: operationName,
            metadata: {
              attempt: attempt + 1,
              maxRetries: config.maxRetries + 1,
              retryDelayMs: Math.round(delay),
            },
          },
          error
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // Non-retryable error or max retries exceeded
        if (attempt > 0) {
          calendarLogger.error(
            `${operationName} failed after ${attempt + 1} attempts`,
            { operation: operationName },
            error
          );
        }
        throw error;
      }
    }
  }

  throw lastError;
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/meetings.space.readonly',
];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  );
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

export async function getUserInfo(accessToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data;
}

export function getCalendarClient(accessToken: string, refreshToken?: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export function getGmailClient(accessToken: string, refreshToken?: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Create a calendar event with Google Meet
export async function createCalendarEvent(
  accessToken: string,
  refreshToken: string,
  event: {
    summary: string;
    description: string;
    startTime: string;
    endTime: string;
    attendeeEmail?: string;
    hostEmail: string;
    coHostEmails?: string[]; // For collective events - all hosts as attendees
    guestEmails?: string[]; // Additional guests invited by the booker
  }
) {
  const calendar = getCalendarClient(accessToken, refreshToken);

  const attendees = [{ email: event.hostEmail }];

  // Add co-hosts as attendees (for collective events)
  if (event.coHostEmails && event.coHostEmails.length > 0) {
    for (const coHost of event.coHostEmails) {
      if (coHost !== event.hostEmail) {
        attendees.push({ email: coHost });
      }
    }
  }

  // Add the primary booker
  if (event.attendeeEmail) {
    attendees.push({ email: event.attendeeEmail });
  }

  // Add additional guests invited by the booker
  if (event.guestEmails && event.guestEmails.length > 0) {
    for (const guest of event.guestEmails) {
      // Avoid duplicates
      if (!attendees.some(a => a.email === guest)) {
        attendees.push({ email: guest });
      }
    }
  }

  // Use retry logic for calendar event creation
  return withRetry(
    async () => {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        sendUpdates: 'all',
        requestBody: {
          summary: event.summary,
          description: event.description,
          start: {
            dateTime: event.startTime,
            timeZone: 'America/New_York',
          },
          end: {
            dateTime: event.endTime,
            timeZone: 'America/New_York',
          },
          attendees,
          conferenceData: {
            createRequest: {
              requestId: `oh-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          guestsCanSeeOtherGuests: false,
        },
      });

      return {
        eventId: response.data.id,
        meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri || null,
        htmlLink: response.data.htmlLink,
      };
    },
    DEFAULT_RETRY_CONFIG,
    'Create calendar event'
  );
}

// Add attendee to existing calendar event
export async function addAttendeeToEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  attendeeEmail: string
) {
  const calendar = getCalendarClient(accessToken, refreshToken);

  return withRetry(
    async () => {
      // First get the current event
      const currentEvent = await calendar.events.get({
        calendarId: 'primary',
        eventId,
      });

      const existingAttendees = currentEvent.data.attendees || [];

      // Add new attendee
      const updatedAttendees = [
        ...existingAttendees,
        { email: attendeeEmail },
      ];

      const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        sendUpdates: 'all',
        requestBody: {
          attendees: updatedAttendees,
        },
      });

      return response.data;
    },
    DEFAULT_RETRY_CONFIG,
    'Add attendee to calendar event'
  );
}

// Remove attendee from existing calendar event
export async function removeAttendeeFromEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  attendeeEmail: string
) {
  const calendar = getCalendarClient(accessToken, refreshToken);

  return withRetry(
    async () => {
      // First get the current event
      const currentEvent = await calendar.events.get({
        calendarId: 'primary',
        eventId,
      });

      const existingAttendees = currentEvent.data.attendees || [];

      // Remove the attendee
      const updatedAttendees = existingAttendees.filter(
        (attendee) => attendee.email?.toLowerCase() !== attendeeEmail.toLowerCase()
      );

      const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        sendUpdates: 'all', // This will send cancellation notice to the removed attendee
        requestBody: {
          attendees: updatedAttendees,
        },
      });

      return response.data;
    },
    DEFAULT_RETRY_CONFIG,
    'Remove attendee from calendar event'
  );
}

// Get free/busy information from Google Calendar
export async function getFreeBusy(
  accessToken: string,
  refreshToken: string,
  timeMin: string,
  timeMax: string,
  calendarId: string = 'primary'
): Promise<Array<{ start: string; end: string }>> {
  const calendar = getCalendarClient(accessToken, refreshToken);

  return withRetry(
    async () => {
      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          timeZone: 'America/New_York',
          items: [{ id: calendarId }],
        },
      });

      const busyTimes = response.data.calendars?.[calendarId]?.busy || [];
      return busyTimes.map((block) => ({
        start: block.start || '',
        end: block.end || '',
      }));
    },
    DEFAULT_RETRY_CONFIG,
    'Get calendar free/busy'
  );
}

// Send email via Gmail API
export async function sendEmail(
  accessToken: string,
  refreshToken: string,
  email: {
    to: string;
    subject: string;
    htmlBody: string;
    replyTo: string;
    from?: string; // Optional explicit From header
  }
): Promise<{ messageId: string; threadId: string }> {
  const gmail = getGmailClient(accessToken, refreshToken);

  const headers = [
    `To: ${email.to}`,
    `Subject: ${email.subject}`,
    `Reply-To: ${email.replyTo}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
  ];

  // Add From header if provided
  if (email.from) {
    headers.unshift(`From: ${email.from}`);
  }

  const message = [...headers, '', email.htmlBody].join('\r\n');

  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return withRetry(
    async () => {
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
      return {
        messageId: response.data.id || '',
        threadId: response.data.threadId || '',
      };
    },
    DEFAULT_RETRY_CONFIG,
    'Send email via Gmail'
  );
}

// Google Meet participant interface
export interface MeetParticipant {
  email: string | null;
  displayName: string | null;
  joinTime: string;
  leaveTime: string | null;
  durationMinutes: number;
}

// Extract meeting code from Google Meet URL
function extractMeetCode(meetLink: string): string | null {
  // Handle various Meet URL formats:
  // https://meet.google.com/abc-defg-hij
  // https://meet.google.com/abc-defg-hij?authuser=0
  const match = meetLink.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return match ? match[1] : null;
}

// Get Google Meet participants for a meeting
export async function getMeetParticipants(
  accessToken: string,
  refreshToken: string,
  meetLink: string,
  meetingStartTime: string,
  meetingEndTime: string
): Promise<{ participants: MeetParticipant[]; error?: string }> {
  const meetCode = extractMeetCode(meetLink);
  if (!meetCode) {
    return { participants: [], error: 'Invalid Google Meet link' };
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  try {
    // The Meet API uses REST calls - googleapis may not have full Meet support
    // We'll use the REST API directly with the OAuth token
    const meetApiBase = 'https://meet.googleapis.com/v2';

    // First, find conference records for this space within the time window
    // The space name format is "spaces/{meetCode}"
    const spaceName = `spaces/${meetCode}`;

    // List conference records (meeting sessions) for this space
    const conferenceRecordsUrl = new URL(`${meetApiBase}/conferenceRecords`);
    conferenceRecordsUrl.searchParams.set('filter', `space.name="${spaceName}"`);

    const recordsResponse = await fetch(conferenceRecordsUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!recordsResponse.ok) {
      const errorText = await recordsResponse.text();
      console.error('Failed to fetch conference records:', errorText);

      // If 403, likely need to re-authenticate with new scope
      if (recordsResponse.status === 403) {
        return {
          participants: [],
          error: 'Permission denied. Please reconnect Google in Integrations to grant Meet access.'
        };
      }
      return { participants: [], error: 'Failed to fetch meeting data from Google Meet' };
    }

    const recordsData = await recordsResponse.json();
    const conferenceRecords = recordsData.conferenceRecords || [];

    if (conferenceRecords.length === 0) {
      return { participants: [], error: 'No meeting sessions found. The meeting may not have started yet.' };
    }

    // Find the conference record that matches our time window
    const meetingStart = new Date(meetingStartTime);
    const meetingEnd = new Date(meetingEndTime);

    // Look for a conference that started within 30 min of scheduled time
    const relevantRecord = conferenceRecords.find((record: { startTime?: string; endTime?: string }) => {
      if (!record.startTime) return false;
      const recordStart = new Date(record.startTime);
      const timeDiff = Math.abs(recordStart.getTime() - meetingStart.getTime());
      // Within 30 minutes of scheduled start
      return timeDiff < 30 * 60 * 1000;
    }) || conferenceRecords[0]; // Fall back to most recent if no match

    if (!relevantRecord) {
      return { participants: [], error: 'No matching meeting session found' };
    }

    // Get participants for this conference record
    const participantsUrl = `${meetApiBase}/${relevantRecord.name}/participants`;
    const participantsResponse = await fetch(participantsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!participantsResponse.ok) {
      const errorText = await participantsResponse.text();
      console.error('Failed to fetch participants:', errorText);
      return { participants: [], error: 'Failed to fetch participant data' };
    }

    const participantsData = await participantsResponse.json();
    const rawParticipants = participantsData.participants || [];

    // Transform participants into our format
    const participants: MeetParticipant[] = rawParticipants.map((p: {
      signedinUser?: { user?: string; displayName?: string };
      anonymousUser?: { displayName?: string };
      earliestStartTime?: string;
      latestEndTime?: string;
    }) => {
      const joinTime = p.earliestStartTime || '';
      const leaveTime = p.latestEndTime || null;

      // Calculate duration in minutes
      let durationMinutes = 0;
      if (joinTime && leaveTime) {
        durationMinutes = Math.round(
          (new Date(leaveTime).getTime() - new Date(joinTime).getTime()) / (1000 * 60)
        );
      }

      // Get email from signedinUser if available
      // The user field format is "users/{userId}" - we need to extract email differently
      let email: string | null = null;
      let displayName: string | null = null;

      if (p.signedinUser) {
        displayName = p.signedinUser.displayName || null;
        // The API may return email in the user field or we need to look elsewhere
        // For now, use displayName if it looks like an email
        if (displayName && displayName.includes('@')) {
          email = displayName;
        }
      } else if (p.anonymousUser) {
        displayName = p.anonymousUser.displayName || 'Anonymous';
      }

      return {
        email,
        displayName,
        joinTime,
        leaveTime,
        durationMinutes,
      };
    });

    return { participants };
  } catch (error) {
    console.error('Error fetching Meet participants:', error);
    return {
      participants: [],
      error: error instanceof Error ? error.message : 'Unknown error fetching meeting data'
    };
  }
}

// Match Meet participants to booking emails and determine attendance
export function matchParticipantsToBookings(
  participants: MeetParticipant[],
  bookings: Array<{ id: string; email: string; first_name: string; last_name: string }>,
  minDurationMinutes: number = 5
): Array<{ bookingId: string; email: string; attended: boolean; duration: number; matchedBy: string }> {
  const results: Array<{ bookingId: string; email: string; attended: boolean; duration: number; matchedBy: string }> = [];

  for (const booking of bookings) {
    const bookingEmail = booking.email.toLowerCase();
    const bookingName = `${booking.first_name} ${booking.last_name}`.toLowerCase();

    // Try to find a matching participant
    const matchedParticipant = participants.find((p) => {
      // Match by email
      if (p.email && p.email.toLowerCase() === bookingEmail) {
        return true;
      }
      // Match by display name containing email
      if (p.displayName && p.displayName.toLowerCase().includes(bookingEmail)) {
        return true;
      }
      // Match by display name matching booking name
      if (p.displayName && p.displayName.toLowerCase().includes(bookingName)) {
        return true;
      }
      // Match by booking name containing display name
      if (p.displayName && bookingName.includes(p.displayName.toLowerCase())) {
        return true;
      }
      return false;
    });

    if (matchedParticipant) {
      const attended = matchedParticipant.durationMinutes >= minDurationMinutes;
      results.push({
        bookingId: booking.id,
        email: booking.email,
        attended,
        duration: matchedParticipant.durationMinutes,
        matchedBy: matchedParticipant.email ? 'email' : 'name',
      });
    } else {
      // No match found - likely no-show
      results.push({
        bookingId: booking.id,
        email: booking.email,
        attended: false,
        duration: 0,
        matchedBy: 'none',
      });
    }
  }

  return results;
}
