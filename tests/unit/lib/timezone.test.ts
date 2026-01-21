import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Timezone Utility Tests
 *
 * Tests the timezone formatting, conversion, and validation utilities.
 * These are pure functions so they don't require complex mocking.
 */

// Import the module
import {
  COMMON_TIMEZONES,
  detectUserTimezone,
  getTimezoneLabel,
  getTimezoneAbbr,
  formatInTimezone,
  formatDateTimeWithTimezone,
  formatTimeRangeInTimezone,
  formatForCalendar,
  convertTimezone,
  getCurrentTimeInTimezone,
  isValidTimezone,
  getUTCOffset,
  getReadableUTCOffset,
  formatForEmail,
  formatSlotsForTimezone,
  groupSlotsByDate,
  getTimezoneOptions,
} from '@/lib/timezone';

// ============================================
// TESTS
// ============================================

describe('Timezone Utilities', () => {
  describe('COMMON_TIMEZONES constant', () => {
    it('contains US timezone options', () => {
      const values = COMMON_TIMEZONES.map((tz) => tz.value);

      expect(values).toContain('America/New_York');
      expect(values).toContain('America/Chicago');
      expect(values).toContain('America/Denver');
      expect(values).toContain('America/Los_Angeles');
      expect(values).toContain('America/Phoenix');
    });

    it('contains international timezone options', () => {
      const values = COMMON_TIMEZONES.map((tz) => tz.value);

      expect(values).toContain('UTC');
      expect(values).toContain('Europe/London');
      expect(values).toContain('Asia/Tokyo');
      expect(values).toContain('Australia/Sydney');
    });

    it('has label and abbreviation for each timezone', () => {
      for (const tz of COMMON_TIMEZONES) {
        expect(tz.value).toBeTruthy();
        expect(tz.label).toBeTruthy();
        expect(tz.abbr).toBeTruthy();
      }
    });
  });

  describe('detectUserTimezone', () => {
    it('returns a valid timezone string', () => {
      const timezone = detectUserTimezone();
      expect(typeof timezone).toBe('string');
      expect(timezone.length).toBeGreaterThan(0);
    });

    it('returns fallback when Intl is unavailable', () => {
      // Save original
      const originalIntl = globalThis.Intl;

      // Mock Intl to throw
      Object.defineProperty(globalThis, 'Intl', {
        value: {
          DateTimeFormat: () => {
            throw new Error('Not available');
          },
        },
        configurable: true,
      });

      const timezone = detectUserTimezone();
      expect(timezone).toBe('America/New_York');

      // Restore
      Object.defineProperty(globalThis, 'Intl', {
        value: originalIntl,
        configurable: true,
      });
    });
  });

  describe('getTimezoneLabel', () => {
    it('returns label for known timezone', () => {
      expect(getTimezoneLabel('America/New_York')).toBe('Eastern Time (ET)');
      expect(getTimezoneLabel('America/Los_Angeles')).toBe('Pacific Time (PT)');
      expect(getTimezoneLabel('UTC')).toBe('UTC');
    });

    it('returns the input for unknown timezone', () => {
      expect(getTimezoneLabel('Unknown/Timezone')).toBe('Unknown/Timezone');
    });
  });

  describe('getTimezoneAbbr', () => {
    it('returns abbreviation for known timezone', () => {
      expect(getTimezoneAbbr('America/New_York')).toBe('ET');
      expect(getTimezoneAbbr('America/Los_Angeles')).toBe('PT');
      expect(getTimezoneAbbr('UTC')).toBe('UTC');
    });

    it('extracts last part of path for unknown timezone', () => {
      expect(getTimezoneAbbr('America/Unknown_City')).toBe('Unknown_City');
    });

    it('returns input if no slash in timezone', () => {
      expect(getTimezoneAbbr('UTC')).toBe('UTC');
    });
  });

  describe('formatInTimezone', () => {
    const testDate = new Date('2024-01-15T14:30:00Z');

    it('formats time in Eastern timezone', () => {
      const result = formatInTimezone(testDate, 'America/New_York', 'h:mm a');
      // In January, Eastern is UTC-5
      expect(result).toBe('9:30 AM');
    });

    it('formats time in Pacific timezone', () => {
      const result = formatInTimezone(testDate, 'America/Los_Angeles', 'h:mm a');
      // In January, Pacific is UTC-8
      expect(result).toBe('6:30 AM');
    });

    it('accepts string date input', () => {
      const result = formatInTimezone('2024-01-15T14:30:00Z', 'UTC', 'h:mm a');
      expect(result).toBe('2:30 PM');
    });

    it('uses default format when not specified', () => {
      const result = formatInTimezone(testDate, 'UTC');
      expect(result).toBe('2:30 PM');
    });

    it('formats with custom format string', () => {
      const result = formatInTimezone(testDate, 'UTC', 'yyyy-MM-dd HH:mm:ss');
      expect(result).toBe('2024-01-15 14:30:00');
    });
  });

  describe('formatDateTimeWithTimezone', () => {
    const testDate = new Date('2024-01-15T14:30:00Z');

    it('formats full date and time with timezone abbreviation', () => {
      const result = formatDateTimeWithTimezone(testDate, 'America/New_York');
      expect(result).toContain('Monday, January 15, 2024');
      expect(result).toContain('9:30 AM');
      expect(result).toContain('ET');
    });

    it('handles string date input', () => {
      const result = formatDateTimeWithTimezone('2024-01-15T14:30:00Z', 'UTC');
      expect(result).toContain('Monday, January 15, 2024');
      expect(result).toContain('2:30 PM');
      expect(result).toContain('UTC');
    });
  });

  describe('formatTimeRangeInTimezone', () => {
    const startDate = new Date('2024-01-15T14:00:00Z');
    const endDate = new Date('2024-01-15T14:30:00Z');

    it('formats time range with timezone', () => {
      const result = formatTimeRangeInTimezone(startDate, endDate, 'UTC');
      expect(result).toBe('2:00 PM - 2:30 PM UTC');
    });

    it('converts to local timezone', () => {
      const result = formatTimeRangeInTimezone(startDate, endDate, 'America/New_York');
      // January = EST (UTC-5)
      expect(result).toBe('9:00 AM - 9:30 AM ET');
    });

    it('handles string date inputs', () => {
      const result = formatTimeRangeInTimezone(
        '2024-01-15T14:00:00Z',
        '2024-01-15T14:30:00Z',
        'UTC'
      );
      expect(result).toBe('2:00 PM - 2:30 PM UTC');
    });
  });

  describe('formatForCalendar', () => {
    const testDate = new Date('2024-01-15T14:30:00Z');

    it('formats with date when showDate is true', () => {
      const result = formatForCalendar(testDate, 'UTC', true);
      expect(result).toContain('Mon, Jan 15');
      expect(result).toContain('2:30 PM');
    });

    it('formats time only when showDate is false', () => {
      const result = formatForCalendar(testDate, 'UTC', false);
      expect(result).toBe('2:30 PM');
    });

    it('defaults to showing date', () => {
      const result = formatForCalendar(testDate, 'UTC');
      expect(result).toContain('Mon, Jan 15');
    });
  });

  describe('convertTimezone', () => {
    it('converts between timezones', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const result = convertTimezone(date, 'UTC', 'America/New_York');

      // The result should be a Date object
      expect(result instanceof Date).toBe(true);
    });

    it('handles string date input', () => {
      const result = convertTimezone('2024-01-15T12:00:00Z', 'UTC', 'America/Los_Angeles');
      expect(result instanceof Date).toBe(true);
    });
  });

  describe('getCurrentTimeInTimezone', () => {
    it('returns a Date object', () => {
      const result = getCurrentTimeInTimezone('UTC');
      expect(result instanceof Date).toBe(true);
    });

    it('returns current time adjusted for timezone', () => {
      const utcTime = getCurrentTimeInTimezone('UTC');
      const nyTime = getCurrentTimeInTimezone('America/New_York');

      // Both should be Date objects (specific times depend on when test runs)
      expect(utcTime instanceof Date).toBe(true);
      expect(nyTime instanceof Date).toBe(true);
    });
  });

  describe('isValidTimezone', () => {
    it('returns true for valid timezones', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
    });

    it('returns false for invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('NotATimezone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });
  });

  describe('getUTCOffset', () => {
    it('returns offset string in format ±HH:MM', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const offset = getUTCOffset('UTC', date);
      expect(offset).toBe('+00:00');
    });

    it('returns negative offset for Western timezones in winter', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const offset = getUTCOffset('America/New_York', date);
      expect(offset).toBe('-05:00');
    });

    it('returns positive offset for Eastern timezones', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const offset = getUTCOffset('Asia/Tokyo', date);
      expect(offset).toBe('+09:00');
    });
  });

  describe('getReadableUTCOffset', () => {
    it('returns UTC for zero offset', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(getReadableUTCOffset('UTC', date)).toBe('UTC');
    });

    it('returns formatted offset for negative offsets', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const result = getReadableUTCOffset('America/New_York', date);
      expect(result).toBe('UTC-5');
    });

    it('returns formatted offset for positive offsets', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const result = getReadableUTCOffset('Asia/Tokyo', date);
      expect(result).toBe('UTC+9');
    });

    it('includes minutes when non-zero', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      // India has UTC+5:30
      const result = getReadableUTCOffset('Asia/Kolkata', date);
      expect(result).toBe('UTC+5:30');
    });
  });

  describe('formatForEmail', () => {
    const testDate = new Date('2024-01-15T14:30:00Z');

    it('returns object with all date/time components', () => {
      const result = formatForEmail(testDate, 'UTC');

      expect(result.date).toBe('Monday, January 15, 2024');
      expect(result.time).toBe('2:30 PM');
      expect(result.timezone).toBe('UTC');
      expect(result.full).toContain('Monday, January 15, 2024');
      expect(result.full).toContain('2:30 PM');
      expect(result.full).toContain('UTC');
    });

    it('converts to target timezone', () => {
      const result = formatForEmail(testDate, 'America/New_York');

      expect(result.time).toBe('9:30 AM');
      expect(result.timezone).toBe('ET');
    });

    it('handles string date input', () => {
      const result = formatForEmail('2024-01-15T14:30:00Z', 'UTC');
      expect(result.date).toBe('Monday, January 15, 2024');
    });
  });

  describe('formatSlotsForTimezone', () => {
    const testSlots = [
      { start_time: '2024-01-15T14:00:00Z', end_time: '2024-01-15T14:30:00Z', id: 'slot-1' },
      { start_time: '2024-01-15T15:00:00Z', end_time: '2024-01-15T15:30:00Z', id: 'slot-2' },
    ];

    it('adds display properties to slots', () => {
      const result = formatSlotsForTimezone(testSlots, 'UTC');

      expect(result).toHaveLength(2);
      expect(result[0].display_start).toBe('2:00 PM');
      expect(result[0].display_end).toBe('2:30 PM');
      expect(result[0].display_date).toBe('Monday, January 15');
      expect(result[0].display_time_range).toBe('2:00 PM - 2:30 PM UTC');
    });

    it('preserves original slot properties', () => {
      const result = formatSlotsForTimezone(testSlots, 'UTC');

      expect(result[0].id).toBe('slot-1');
      expect(result[0].start_time).toBe('2024-01-15T14:00:00Z');
      expect(result[0].end_time).toBe('2024-01-15T14:30:00Z');
    });

    it('converts to target timezone', () => {
      const result = formatSlotsForTimezone(testSlots, 'America/New_York');

      expect(result[0].display_start).toBe('9:00 AM');
      expect(result[0].display_time_range).toContain('9:00 AM');
      expect(result[0].display_time_range).toContain('ET');
    });
  });

  describe('groupSlotsByDate', () => {
    const testSlots = [
      { start_time: '2024-01-15T14:00:00Z', id: 'slot-1' },
      { start_time: '2024-01-15T16:00:00Z', id: 'slot-2' },
      { start_time: '2024-01-16T14:00:00Z', id: 'slot-3' },
    ];

    it('groups slots by date key', () => {
      const result = groupSlotsByDate(testSlots, 'UTC');

      expect(result.size).toBe(2);
      expect(result.has('2024-01-15')).toBe(true);
      expect(result.has('2024-01-16')).toBe(true);
    });

    it('puts multiple slots on same day in same group', () => {
      const result = groupSlotsByDate(testSlots, 'UTC');

      const jan15Slots = result.get('2024-01-15');
      expect(jan15Slots).toHaveLength(2);
    });

    it('respects timezone for date boundaries', () => {
      // This slot at 3:00 UTC is still Jan 14 in Pacific time
      const edgeSlots = [
        { start_time: '2024-01-15T03:00:00Z', id: 'slot-1' },
      ];

      const utcResult = groupSlotsByDate(edgeSlots, 'UTC');
      const pacificResult = groupSlotsByDate(edgeSlots, 'America/Los_Angeles');

      expect(utcResult.has('2024-01-15')).toBe(true);
      expect(pacificResult.has('2024-01-14')).toBe(true);
    });
  });

  describe('getTimezoneOptions', () => {
    it('returns array of timezone options', () => {
      const options = getTimezoneOptions();

      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBe(COMMON_TIMEZONES.length);
    });

    it('includes value, label, and offset for each option', () => {
      const options = getTimezoneOptions();

      for (const option of options) {
        expect(option.value).toBeTruthy();
        expect(option.label).toBeTruthy();
        expect(option.offset).toBeTruthy();
      }
    });

    it('returns options sorted by UTC offset', () => {
      const options = getTimezoneOptions();

      // Hawaii should be near the beginning (UTC-10)
      // Tokyo should be near the end (UTC+9)
      const hawaiiIndex = options.findIndex((o) => o.value === 'Pacific/Honolulu');
      const tokyoIndex = options.findIndex((o) => o.value === 'Asia/Tokyo');

      expect(hawaiiIndex).toBeLessThan(tokyoIndex);
    });
  });
});
