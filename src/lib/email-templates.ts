import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';

export interface EmailTemplateVariables {
  first_name: string;
  last_name: string;
  email: string;
  event_name: string;
  host_name: string;
  date: string;
  time: string;
  time_with_timezone: string;
  timezone: string;
  timezone_abbr: string;
  meet_link: string;
  reminder_timing?: string;
  assigned_host_name?: string;
  assigned_host_email?: string;
  is_round_robin?: string;
  rebook_link?: string;
  booking_link?: string;
}

export const defaultTemplates = {
  confirmation_subject: "You're all set for {{event_name}}!",
  confirmation_body: `Hi {{first_name}},

Great news - your spot is confirmed! I'm looking forward to connecting with you.

Session details:
{{event_name}}
{{date}} at {{time_with_timezone}}

Come prepared with any questions or topics you'd like to discuss. This time is dedicated to you, so don't hesitate to bring up whatever's on your mind.

See you soon!
{{host_name}}`,

  reminder_subject: 'See you {{reminder_timing}} - {{event_name}}',
  reminder_body: `Hi {{first_name}},

Just a friendly reminder that we're meeting {{reminder_timing}}.

{{event_name}}
{{date}} at {{time_with_timezone}}

If something came up and you need to reschedule, no worries - just use the link at the bottom of this email.

Looking forward to our conversation!
{{host_name}}`,

  cancellation_subject: 'Your {{event_name}} session has been cancelled',
  cancellation_body: `Hi {{first_name}},

Your {{event_name}} session scheduled for {{date}} at {{time_with_timezone}} has been cancelled.

If you'd like to book another time, I'd love to still connect with you:
{{booking_link}}

Best,
{{host_name}}`,

  no_show_subject: 'We missed you at {{event_name}}!',
  no_show_body: `Hi {{first_name}},

We noticed you weren't able to join {{event_name}} today. No worries - life happens!

We'd love to connect with you. Feel free to book another session at a time that works better for you:

{{rebook_link}}

If you have any questions, just reply to this email.

Best,
{{host_name}}`,
};

export function processTemplate(
  template: string,
  variables: EmailTemplateVariables
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }

  return result;
}

// Common timezone abbreviations mapping
const TIMEZONE_ABBR: Record<string, string> = {
  'America/New_York': 'ET',
  'America/Chicago': 'CT',
  'America/Denver': 'MT',
  'America/Los_Angeles': 'PT',
  'America/Phoenix': 'MST',
  'America/Anchorage': 'AKT',
  'Pacific/Honolulu': 'HST',
  'Europe/London': 'GMT',
  'Europe/Paris': 'CET',
  'Europe/Berlin': 'CET',
  'Asia/Tokyo': 'JST',
  'Asia/Shanghai': 'CST',
  'Asia/Singapore': 'SGT',
  'Australia/Sydney': 'AEST',
  'UTC': 'UTC',
};

function getTimezoneAbbr(tz: string): string {
  return TIMEZONE_ABBR[tz] || tz.split('/').pop()?.replace(/_/g, ' ') || tz;
}

function getTimezoneName(tz: string): string {
  const names: Record<string, string> = {
    'America/New_York': 'Eastern Time',
    'America/Chicago': 'Central Time',
    'America/Denver': 'Mountain Time',
    'America/Los_Angeles': 'Pacific Time',
    'America/Phoenix': 'Arizona Time',
    'Europe/London': 'London Time',
    'Europe/Paris': 'Paris Time',
    'Asia/Tokyo': 'Tokyo Time',
  };
  return names[tz] || tz.split('/').pop()?.replace(/_/g, ' ') || tz;
}

export function createEmailVariables(
  booking: { first_name: string; last_name: string; email: string },
  event: { name: string; host_name: string; meeting_type?: string; slug?: string },
  slot: { start_time: string; end_time: string; google_meet_link: string | null },
  timezone: string = 'America/New_York',
  reminderTiming?: string,
  assignedHost?: { name: string | null; email: string } | null,
  options?: { bookingLink?: string; rebookLink?: string }
): EmailTemplateVariables {
  const startDate = parseISO(slot.start_time);
  const timezoneAbbr = getTimezoneAbbr(timezone);
  const isRoundRobin = event.meeting_type === 'round_robin';

  // For round-robin events, use the assigned host name in the signature
  const effectiveHostName = isRoundRobin && assignedHost
    ? assignedHost.name || assignedHost.email.split('@')[0]
    : event.host_name;

  // Generate default booking link if slug is available
  const defaultBookingLink = event.slug
    ? `${process.env.NEXT_PUBLIC_APP_URL}/book/${event.slug}`
    : undefined;

  return {
    first_name: booking.first_name,
    last_name: booking.last_name,
    email: booking.email,
    event_name: event.name,
    host_name: effectiveHostName,
    date: formatInTimeZone(startDate, timezone, 'EEEE, MMMM d, yyyy'),
    time: formatInTimeZone(startDate, timezone, 'h:mm a'),
    time_with_timezone: `${formatInTimeZone(startDate, timezone, 'h:mm a')} ${timezoneAbbr}`,
    timezone: getTimezoneName(timezone),
    timezone_abbr: timezoneAbbr,
    meet_link: slot.google_meet_link || 'Link will be provided',
    reminder_timing: reminderTiming,
    assigned_host_name: assignedHost ? (assignedHost.name || assignedHost.email.split('@')[0]) : undefined,
    assigned_host_email: assignedHost?.email,
    is_round_robin: isRoundRobin ? 'true' : undefined,
    booking_link: options?.bookingLink || defaultBookingLink,
    rebook_link: options?.rebookLink || defaultBookingLink,
  };
}

export function htmlifyEmailBody(text: string): string {
  // Convert plain text to simple HTML
  return text
    .split('\n\n')
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
