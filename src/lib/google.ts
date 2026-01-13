import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
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
