import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');

import {
  processTemplate,
  createEmailVariables,
  htmlifyEmailBody,
  defaultTemplates,
} from '@/lib/email-templates';

describe('email-templates', () => {
  // =========================================
  // processTemplate
  // =========================================
  describe('processTemplate', () => {
    const baseVars = {
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      event_name: 'Office Hours',
      host_name: 'Laura',
      date: 'Monday, January 20, 2025',
      time: '2:00 PM',
      time_with_timezone: '2:00 PM CT',
      timezone: 'Central Time',
      timezone_abbr: 'CT',
      meet_link: 'https://meet.google.com/abc-def-ghi',
    };

    it('replaces all template variables', () => {
      const template = 'Hi {{first_name}} {{last_name}}, welcome to {{event_name}}!';
      const result = processTemplate(template, baseVars);
      expect(result).toBe('Hi Jane Doe, welcome to Office Hours!');
    });

    it('replaces multiple occurrences of the same variable', () => {
      const template = '{{event_name}} is great! {{event_name}} starts at {{time}}.';
      const result = processTemplate(template, baseVars);
      expect(result).toBe('Office Hours is great! Office Hours starts at 2:00 PM.');
    });

    it('leaves unset optional variables as empty string when key exists', () => {
      const vars = { ...baseVars, reminder_timing: undefined as unknown as string };
      const template = 'Reminder: {{reminder_timing}} - {{event_name}}';
      const result = processTemplate(template, vars);
      expect(result).toBe('Reminder:  - Office Hours');
    });

    it('leaves template tags for keys not in variables object', () => {
      const template = 'Reminder: {{reminder_timing}} - {{event_name}}';
      const result = processTemplate(template, baseVars);
      expect(result).toBe('Reminder: {{reminder_timing}} - Office Hours');
    });

    it('preserves text with no variables', () => {
      const result = processTemplate('Plain text with no variables.', baseVars);
      expect(result).toBe('Plain text with no variables.');
    });

    it('handles empty template', () => {
      const result = processTemplate('', baseVars);
      expect(result).toBe('');
    });

    it('processes default confirmation subject correctly', () => {
      const result = processTemplate(defaultTemplates.confirmation_subject, baseVars);
      expect(result).toBe("You're all set for Office Hours!");
    });

    it('processes default reminder subject with timing', () => {
      const vars = { ...baseVars, reminder_timing: 'tomorrow' };
      const result = processTemplate(defaultTemplates.reminder_subject, vars);
      expect(result).toBe('See you tomorrow - Office Hours');
    });

    it('processes assigned host variables for round-robin', () => {
      const vars = {
        ...baseVars,
        assigned_host_name: 'Mike',
        assigned_host_email: 'mike@example.com',
        is_round_robin: 'true',
      };
      const template = 'Your session is with {{assigned_host_name}} ({{assigned_host_email}})';
      const result = processTemplate(template, vars);
      expect(result).toBe('Your session is with Mike (mike@example.com)');
    });

    it('handles booking_link and rebook_link variables', () => {
      const vars = {
        ...baseVars,
        booking_link: 'https://app.example.com/book/test',
        rebook_link: 'https://app.example.com/book/test',
      };
      const template = 'Book again: {{rebook_link}}';
      const result = processTemplate(template, vars);
      expect(result).toBe('Book again: https://app.example.com/book/test');
    });
  });

  // =========================================
  // createEmailVariables
  // =========================================
  describe('createEmailVariables', () => {
    const booking = {
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
    };

    const event = {
      name: 'Office Hours',
      host_name: 'Laura',
      meeting_type: 'one_on_one',
      slug: 'office-hours',
    };

    const slot = {
      start_time: '2025-01-20T20:00:00.000Z', // 2 PM CT
      end_time: '2025-01-20T20:30:00.000Z',
      google_meet_link: 'https://meet.google.com/abc-def-ghi',
    };

    it('creates variables with correct field values', () => {
      const vars = createEmailVariables(booking, event, slot, 'America/Chicago');
      expect(vars.first_name).toBe('Jane');
      expect(vars.last_name).toBe('Doe');
      expect(vars.email).toBe('jane@example.com');
      expect(vars.event_name).toBe('Office Hours');
      expect(vars.host_name).toBe('Laura');
      expect(vars.meet_link).toBe('https://meet.google.com/abc-def-ghi');
    });

    it('formats date in correct timezone', () => {
      const vars = createEmailVariables(booking, event, slot, 'America/Chicago');
      expect(vars.date).toBe('Monday, January 20, 2025');
      expect(vars.time).toBe('2:00 PM');
      expect(vars.timezone_abbr).toBe('CT');
      expect(vars.time_with_timezone).toBe('2:00 PM CT');
    });

    it('formats for Eastern Time correctly', () => {
      const vars = createEmailVariables(booking, event, slot, 'America/New_York');
      expect(vars.time).toBe('3:00 PM');
      expect(vars.timezone_abbr).toBe('ET');
      expect(vars.timezone).toBe('Eastern Time');
    });

    it('defaults to America/New_York timezone', () => {
      const vars = createEmailVariables(booking, event, slot);
      expect(vars.timezone_abbr).toBe('ET');
    });

    it('uses event host_name for non-round-robin events', () => {
      const vars = createEmailVariables(booking, event, slot, 'America/Chicago');
      expect(vars.host_name).toBe('Laura');
      expect(vars.is_round_robin).toBeUndefined();
    });

    it('uses assigned host name for round-robin events', () => {
      const rrEvent = { ...event, meeting_type: 'round_robin' };
      const assignedHost = { name: 'Mike', email: 'mike@example.com' };
      const vars = createEmailVariables(booking, rrEvent, slot, 'America/Chicago', undefined, assignedHost);
      expect(vars.host_name).toBe('Mike');
      expect(vars.assigned_host_name).toBe('Mike');
      expect(vars.assigned_host_email).toBe('mike@example.com');
      expect(vars.is_round_robin).toBe('true');
    });

    it('falls back to email prefix when assigned host has no name', () => {
      const rrEvent = { ...event, meeting_type: 'round_robin' };
      const assignedHost = { name: null, email: 'mike@example.com' };
      const vars = createEmailVariables(booking, rrEvent, slot, 'America/Chicago', undefined, assignedHost);
      expect(vars.host_name).toBe('mike');
      expect(vars.assigned_host_name).toBe('mike');
    });

    it('uses event host for round-robin when no host assigned', () => {
      const rrEvent = { ...event, meeting_type: 'round_robin' };
      const vars = createEmailVariables(booking, rrEvent, slot, 'America/Chicago', undefined, null);
      expect(vars.host_name).toBe('Laura');
      expect(vars.is_round_robin).toBe('true');
    });

    it('includes reminder timing when provided', () => {
      const vars = createEmailVariables(booking, event, slot, 'America/Chicago', 'tomorrow');
      expect(vars.reminder_timing).toBe('tomorrow');
    });

    it('shows placeholder when no Meet link', () => {
      const noMeetSlot = { ...slot, google_meet_link: null };
      const vars = createEmailVariables(booking, event, noMeetSlot, 'America/Chicago');
      expect(vars.meet_link).toBe('Link will be provided');
    });

    it('generates booking_link from event slug', () => {
      const vars = createEmailVariables(booking, event, slot, 'America/Chicago');
      expect(vars.booking_link).toBe('https://app.example.com/book/office-hours');
      expect(vars.rebook_link).toBe('https://app.example.com/book/office-hours');
    });

    it('uses custom booking/rebook links from options', () => {
      const vars = createEmailVariables(
        booking, event, slot, 'America/Chicago', undefined, null,
        { bookingLink: 'https://custom.link/book', rebookLink: 'https://custom.link/rebook' }
      );
      expect(vars.booking_link).toBe('https://custom.link/book');
      expect(vars.rebook_link).toBe('https://custom.link/rebook');
    });

    it('handles event without slug', () => {
      const noSlugEvent = { ...event, slug: undefined };
      const vars = createEmailVariables(booking, noSlugEvent, slot, 'America/Chicago');
      expect(vars.booking_link).toBeUndefined();
    });

    it('handles uncommon timezone with fallback abbreviation', () => {
      const vars = createEmailVariables(booking, event, slot, 'Asia/Kolkata');
      expect(vars.timezone_abbr).toBe('Kolkata');
    });
  });

  // =========================================
  // htmlifyEmailBody
  // =========================================
  describe('htmlifyEmailBody', () => {
    it('wraps paragraphs in <p> tags', () => {
      const result = htmlifyEmailBody('First paragraph\n\nSecond paragraph');
      expect(result).toBe('<p>First paragraph</p><p>Second paragraph</p>');
    });

    it('converts single newlines to <br>', () => {
      const result = htmlifyEmailBody('Line one\nLine two');
      expect(result).toBe('<p>Line one<br>Line two</p>');
    });

    it('handles mixed paragraphs and line breaks', () => {
      const result = htmlifyEmailBody('Para 1 line 1\nPara 1 line 2\n\nPara 2');
      expect(result).toBe('<p>Para 1 line 1<br>Para 1 line 2</p><p>Para 2</p>');
    });

    it('escapes HTML in input to prevent XSS', () => {
      const result = htmlifyEmailBody('Hello <script>alert("xss")</script>');
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });

    it('escapes ampersands and quotes', () => {
      const result = htmlifyEmailBody('Tom & Jerry said "hello"');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });

    it('handles empty string', () => {
      const result = htmlifyEmailBody('');
      expect(result).toBe('<p></p>');
    });

    it('handles string with only newlines', () => {
      const result = htmlifyEmailBody('\n\n');
      expect(result).toBe('<p></p><p></p>');
    });
  });
});
