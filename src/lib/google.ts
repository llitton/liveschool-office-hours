import { google } from 'googleapis';

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
  }
) {
  const calendar = getCalendarClient(accessToken, refreshToken);

  const attendees = [{ email: event.hostEmail }];
  if (event.attendeeEmail) {
    attendees.push({ email: event.attendeeEmail });
  }

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
          requestId: `oh-${Date.now()}`,
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
}

// Add attendee to existing calendar event
export async function addAttendeeToEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  attendeeEmail: string
) {
  const calendar = getCalendarClient(accessToken, refreshToken);

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
}

// Remove attendee from existing calendar event
export async function removeAttendeeFromEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  attendeeEmail: string
) {
  const calendar = getCalendarClient(accessToken, refreshToken);

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
  }
) {
  const gmail = getGmailClient(accessToken, refreshToken);

  const message = [
    `To: ${email.to}`,
    `Subject: ${email.subject}`,
    `Reply-To: ${email.replyTo}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    email.htmlBody,
  ].join('\n');

  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });
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
