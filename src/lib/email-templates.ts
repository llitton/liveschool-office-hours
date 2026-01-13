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
  confirmation_subject: "You're confirmed for {{event_name}}",
  confirmation_body: `Hi {{first_name}},

You're confirmed for {{event_name}} on {{date}} at {{time}}.

Join via Google Meet: {{meet_link}}

See you there!
{{host_name}}`,

  reminder_subject: 'Reminder: {{event_name}} is coming up!',
  reminder_body: `Hi {{first_name}},

This is a friendly reminder that {{event_name}} is {{reminder_timing}}.

Date: {{date}}
Time: {{time}}
Join via Google Meet: {{meet_link}}

See you soon!
{{host_name}}`,

  cancellation_subject: '{{event_name}} has been cancelled',
  cancellation_body: `Hi {{first_name}},

Unfortunately, {{event_name}} scheduled for {{date}} at {{time}} has been cancelled.

We apologize for any inconvenience. Please check our booking page for other available times.

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
