import { describe, it, expect } from 'vitest';
import {
  generateConfirmationEmailHtml,
  generateReminderEmailHtml,
} from '@/lib/email-html';

describe('Email HTML Templates', () => {
  describe('generateConfirmationEmailHtml', () => {
    const baseData = {
      firstName: 'Laura',
      eventName: 'Office Hours',
      hostName: 'Sarah Smith',
      date: 'Thursday, January 23, 2026',
      time: '3:00 PM',
      timezoneAbbr: 'CT',
      timezone: 'Central Time',
      meetLink: 'https://meet.google.com/abc-defg-hij',
      manageUrl: 'https://liveschoolhelp.com/manage/token123',
      googleCalUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE',
      outlookUrl: 'https://outlook.live.com/calendar/0/deeplink/compose',
      icalUrl: 'https://liveschoolhelp.com/api/ical/token123',
    };

    it('generates valid HTML document', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('includes event name in hero section', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('Office Hours');
      expect(html).toContain("You're all set");
    });

    it('includes date and time with timezone', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('Thursday, January 23, 2026');
      expect(html).toContain('3:00 PM');
      expect(html).toContain('CT');
      expect(html).toContain('Central Time');
    });

    it('includes host name', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('Sarah Smith');
    });

    it('includes Google Meet link when provided', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('https://meet.google.com/abc-defg-hij');
      expect(html).toContain('Join Google Meet');
    });

    it('omits Join Meeting section when no meet link', () => {
      const dataWithoutMeet = { ...baseData, meetLink: null };
      const html = generateConfirmationEmailHtml(dataWithoutMeet);

      expect(html).not.toContain('Join Google Meet');
    });

    it('includes all three calendar buttons', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('Google');
      expect(html).toContain('Outlook');
      expect(html).toContain('Apple');
      expect(html).toContain(baseData.googleCalUrl);
      expect(html).toContain(baseData.outlookUrl);
      expect(html).toContain(baseData.icalUrl);
    });

    it('includes reschedule/cancel link', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('Reschedule or Cancel');
      expect(html).toContain(baseData.manageUrl);
    });

    it('includes school name when provided', () => {
      const dataWithSchool = { ...baseData, schoolName: 'Lincoln Elementary' };
      const html = generateConfirmationEmailHtml(dataWithSchool);

      expect(html).toContain('Lincoln Elementary');
    });

    it('includes event description when provided', () => {
      const dataWithDesc = {
        ...baseData,
        eventDescription: 'A one-on-one session to discuss your questions about LiveSchool.',
      };
      const html = generateConfirmationEmailHtml(dataWithDesc);

      expect(html).toContain('About This Session');
      expect(html).toContain('A one-on-one session to discuss your questions about LiveSchool.');
    });

    it('includes user topic when provided', () => {
      const dataWithTopic = {
        ...baseData,
        userTopic: 'How do I set up rewards for students?',
      };
      const html = generateConfirmationEmailHtml(dataWithTopic);

      expect(html).toContain('What you want to discuss');
      expect(html).toContain('How do I set up rewards for students?');
    });

    it('includes prep materials checklist when provided', () => {
      const dataWithPrep = {
        ...baseData,
        prepMaterials: 'Review your current setup\nPrepare questions',
      };
      const html = generateConfirmationEmailHtml(dataWithPrep);

      expect(html).toContain('Before Your Session');
      expect(html).toContain('Review your current setup');
      expect(html).toContain('Prepare questions');
    });

    it('includes prep resources when provided', () => {
      const dataWithResources = {
        ...baseData,
        prepResources: [
          { title: 'Getting Started Guide', content: 'Learn the basics', link: 'https://example.com/guide' },
          { title: 'FAQ', content: 'Common questions', link: 'https://example.com/faq' },
        ],
      };
      const html = generateConfirmationEmailHtml(dataWithResources);

      expect(html).toContain('Helpful Resources');
      expect(html).toContain('Getting Started Guide');
      expect(html).toContain('Learn the basics');
      expect(html).toContain('https://example.com/guide');
      expect(html).toContain('FAQ');
      expect(html).toContain('Common questions');
    });

    it('includes custom body HTML when provided', () => {
      const dataWithCustomBody = {
        ...baseData,
        customBodyHtml: '<p>Custom welcome message here!</p>',
      };
      const html = generateConfirmationEmailHtml(dataWithCustomBody);

      expect(html).toContain('Custom welcome message here!');
      // Custom body replaces default "What to Expect" section
      expect(html).not.toContain('What to Expect');
    });

    it('shows default "What to Expect" when no custom body', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('What to Expect');
      expect(html).toContain('Your Time, Your Topics');
      expect(html).toContain('Practical Guidance');
    });

    it('uses brand colors in styling', () => {
      const html = generateConfirmationEmailHtml(baseData);

      // Check for brand purple
      expect(html).toContain('#6F71EE');
      // Check for brand navy
      expect(html).toContain('#101E57');
      // Check for brand green
      expect(html).toContain('#417762');
    });

    it('includes LiveSchool branding in footer', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('Connect with LiveSchool');
    });

    it('uses table-based layout for email compatibility', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('role="presentation"');
      expect(html).toContain('<table');
      expect(html).toContain('<td');
    });

    it('includes viewport meta tag for mobile', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('width=device-width, initial-scale=1.0');
    });

    it('uses inline styles (not external stylesheets)', () => {
      const html = generateConfirmationEmailHtml(baseData);

      // Should have inline styles
      expect(html).toContain('style="');
      // Should not link external stylesheets
      expect(html).not.toContain('<link rel="stylesheet"');
    });
  });

  describe('generateReminderEmailHtml', () => {
    const baseData = {
      firstName: 'Laura',
      eventName: 'Office Hours',
      hostName: 'Sarah Smith',
      date: 'Thursday, January 23',
      time: '3:00 PM',
      timezoneAbbr: 'CT',
      meetLink: 'https://meet.google.com/abc-defg-hij',
      manageUrl: 'https://liveschoolhelp.com/manage/token123',
      reminderTiming: 'tomorrow',
    };

    it('generates valid HTML document', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('includes greeting with first name', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('Hi Laura');
    });

    it('includes event details', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('Office Hours');
      expect(html).toContain('Thursday, January 23');
      expect(html).toContain('3:00 PM');
      expect(html).toContain('CT');
      expect(html).toContain('Sarah Smith');
    });

    it('includes reminder timing in header', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('See you tomorrow');
    });

    it('uses purple header for day-before reminders', () => {
      const html = generateReminderEmailHtml(baseData);

      // Brand purple
      expect(html).toContain('#6F71EE');
    });

    it('uses urgent (amber) header for hour-before reminders', () => {
      const urgentData = { ...baseData, reminderTiming: 'in about 1 hour' };
      const html = generateReminderEmailHtml(urgentData);

      // Amber/warning color
      expect(html).toContain('#F59E0B');
    });

    it('includes Google Meet link when provided', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('https://meet.google.com/abc-defg-hij');
      expect(html).toContain('Join Google Meet');
    });

    it('omits Join Meeting button when no meet link', () => {
      const dataWithoutMeet = { ...baseData, meetLink: null };
      const html = generateReminderEmailHtml(dataWithoutMeet);

      expect(html).not.toContain('Join Google Meet');
    });

    it('includes reschedule link', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('Need to reschedule');
      expect(html).toContain(baseData.manageUrl);
    });

    it('uses calendar emoji for day-before reminders', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('📅');
    });

    it('uses clock emoji for hour-before reminders', () => {
      const urgentData = { ...baseData, reminderTiming: 'in about 1 hour' };
      const html = generateReminderEmailHtml(urgentData);

      expect(html).toContain('⏰');
    });

    it('uses table-based layout for email compatibility', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('role="presentation"');
      expect(html).toContain('<table');
    });

    it('uses inline styles', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('style="');
      expect(html).not.toContain('<link rel="stylesheet"');
    });
  });
});
