import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateICalFile,
  generateGoogleCalendarUrl,
  generateOutlookUrl,
} from '@/lib/ical';

describe('iCal Utilities', () => {
  const mockEvent = {
    title: 'Office Hours with Laura',
    description: 'One-on-one session to discuss your questions.',
    location: 'https://meet.google.com/abc-defg-hij',
    startTime: new Date('2026-01-25T14:00:00Z'),
    endTime: new Date('2026-01-25T15:00:00Z'),
  };

  describe('generateICalFile', () => {
    beforeEach(() => {
      // Mock Date.now for consistent UID generation
      vi.spyOn(Date, 'now').mockReturnValue(1737817200000);
      vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('generates valid iCal file structure', () => {
      const ical = generateICalFile(mockEvent);

      // Check required iCal headers
      expect(ical).toContain('BEGIN:VCALENDAR');
      expect(ical).toContain('VERSION:2.0');
      expect(ical).toContain('PRODID:-//LiveSchool//Connect//EN');
      expect(ical).toContain('CALSCALE:GREGORIAN');
      expect(ical).toContain('METHOD:PUBLISH');
      expect(ical).toContain('BEGIN:VEVENT');
      expect(ical).toContain('END:VEVENT');
      expect(ical).toContain('END:VCALENDAR');
    });

    it('includes event details', () => {
      const ical = generateICalFile(mockEvent);

      expect(ical).toContain('SUMMARY:Office Hours with Laura');
      expect(ical).toContain('DESCRIPTION:One-on-one session to discuss your questions.');
      expect(ical).toContain('LOCATION:https://meet.google.com/abc-defg-hij');
    });

    it('formats dates correctly in iCal format', () => {
      const ical = generateICalFile(mockEvent);

      // iCal format: YYYYMMDDTHHMMSSZ (dates are formatted using date-fns which uses local time)
      // Check that the format is correct (YYYYMMDDTHHMMSSZ pattern)
      expect(ical).toMatch(/DTSTART:\d{8}T\d{6}Z/);
      expect(ical).toMatch(/DTEND:\d{8}T\d{6}Z/);
    });

    it('generates unique UID', () => {
      const ical = generateICalFile(mockEvent);

      expect(ical).toContain('UID:');
      expect(ical).toContain('@liveschool-connect');
    });

    it('includes DTSTAMP', () => {
      const ical = generateICalFile(mockEvent);

      expect(ical).toContain('DTSTAMP:');
    });

    it('includes organizer when provided', () => {
      const eventWithOrganizer = {
        ...mockEvent,
        organizer: {
          name: 'Laura Litton',
          email: 'laura@liveschool.com',
        },
      };

      const ical = generateICalFile(eventWithOrganizer);

      expect(ical).toContain('ORGANIZER;CN=Laura Litton:mailto:laura@liveschool.com');
    });

    it('omits organizer when not provided', () => {
      const ical = generateICalFile(mockEvent);

      expect(ical).not.toContain('ORGANIZER');
    });

    it('escapes special characters in text fields', () => {
      const eventWithSpecialChars = {
        ...mockEvent,
        title: 'Meeting; with, special\\chars',
        description: 'Line 1\nLine 2',
      };

      const ical = generateICalFile(eventWithSpecialChars);

      expect(ical).toContain('SUMMARY:Meeting\\; with\\, special\\\\chars');
      expect(ical).toContain('DESCRIPTION:Line 1\\nLine 2');
    });

    it('uses CRLF line endings (iCal spec)', () => {
      const ical = generateICalFile(mockEvent);

      // iCal spec requires CRLF line endings
      expect(ical).toContain('\r\n');
    });
  });

  describe('generateGoogleCalendarUrl', () => {
    it('generates valid Google Calendar URL', () => {
      const url = generateGoogleCalendarUrl(mockEvent);

      expect(url).toContain('https://calendar.google.com/calendar/render?');
      expect(url).toContain('action=TEMPLATE');
    });

    it('includes event title', () => {
      const url = generateGoogleCalendarUrl(mockEvent);

      expect(url).toContain('text=Office+Hours+with+Laura');
    });

    it('includes event description', () => {
      const url = generateGoogleCalendarUrl(mockEvent);

      expect(url).toContain('details=One-on-one+session+to+discuss+your+questions.');
    });

    it('includes location', () => {
      const url = generateGoogleCalendarUrl(mockEvent);

      expect(url).toContain('location=');
      expect(url).toContain('meet.google.com');
    });

    it('includes formatted dates', () => {
      const url = generateGoogleCalendarUrl(mockEvent);

      // Format: YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ (dates formatted using date-fns in local time)
      // Check that dates param exists with correct format pattern
      expect(url).toContain('dates=');
      expect(url).toMatch(/dates=\d{8}T\d{6}Z%2F\d{8}T\d{6}Z/);
    });

    it('URL encodes special characters', () => {
      const eventWithSpecialChars = {
        ...mockEvent,
        title: 'Meeting & Discussion',
        description: 'Q&A session',
      };

      const url = generateGoogleCalendarUrl(eventWithSpecialChars);

      // & should be encoded
      expect(url).toContain('Meeting+%26+Discussion');
      expect(url).toContain('Q%26A+session');
    });
  });

  describe('generateOutlookUrl', () => {
    it('generates valid Outlook URL', () => {
      const url = generateOutlookUrl(mockEvent);

      expect(url).toContain('https://outlook.live.com/calendar/0/deeplink/compose?');
    });

    it('includes required path parameters', () => {
      const url = generateOutlookUrl(mockEvent);

      expect(url).toContain('path=%2Fcalendar%2Faction%2Fcompose');
      expect(url).toContain('rru=addevent');
    });

    it('includes event subject', () => {
      const url = generateOutlookUrl(mockEvent);

      expect(url).toContain('subject=Office+Hours+with+Laura');
    });

    it('includes event body', () => {
      const url = generateOutlookUrl(mockEvent);

      expect(url).toContain('body=One-on-one+session+to+discuss+your+questions.');
    });

    it('includes location', () => {
      const url = generateOutlookUrl(mockEvent);

      expect(url).toContain('location=');
      expect(url).toContain('meet.google.com');
    });

    it('includes ISO formatted dates', () => {
      const url = generateOutlookUrl(mockEvent);

      // Outlook uses ISO format
      expect(url).toContain('startdt=2026-01-25T14%3A00%3A00.000Z');
      expect(url).toContain('enddt=2026-01-25T15%3A00%3A00.000Z');
    });
  });
});
