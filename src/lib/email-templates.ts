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
  meet_link: string;
  reminder_timing?: string;
}

export const defaultTemplates = {
  confirmation_subject: "You're all set for {{event_name}}!",
  confirmation_body: `Hi {{first_name}},

Great news - your spot is confirmed! I'm looking forward to connecting with you.

Session details:
{{event_name}}
{{date}} at {{time}}

Come prepared with any questions or topics you'd like to discuss. This time is dedicated to you, so don't hesitate to bring up whatever's on your mind.

See you soon!
{{host_name}}`,

  reminder_subject: 'See you {{reminder_timing}} - {{event_name}}',
  reminder_body: `Hi {{first_name}},

Just a friendly reminder that we're meeting {{reminder_timing}}.

{{event_name}}
{{date}} at {{time}}

If something came up and you need to reschedule, no worries - just use the link at the bottom of this email.

Looking forward to our conversation!
{{host_name}}`,

  cancellation_subject: 'Your {{event_name}} session has been cancelled',
  cancellation_body: `Hi {{first_name}},

Your {{event_name}} session scheduled for {{date}} at {{time}} has been cancelled.

If you'd like to book another time, I'd love to still connect with you. Just head back to the booking page to find a time that works.

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

export function createEmailVariables(
  booking: { first_name: string; last_name: string; email: string },
  event: { name: string; host_name: string },
  slot: { start_time: string; end_time: string; google_meet_link: string | null },
  timezone: string = 'America/New_York',
  reminderTiming?: string
): EmailTemplateVariables {
  const startDate = parseISO(slot.start_time);

  return {
    first_name: booking.first_name,
    last_name: booking.last_name,
    email: booking.email,
    event_name: event.name,
    host_name: event.host_name,
    date: formatInTimeZone(startDate, timezone, 'EEEE, MMMM d, yyyy'),
    time: formatInTimeZone(startDate, timezone, 'h:mm a z'),
    meet_link: slot.google_meet_link || 'Link will be provided',
    reminder_timing: reminderTiming,
  };
}

export function htmlifyEmailBody(text: string): string {
  // Convert plain text to simple HTML
  return text
    .split('\n\n')
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
