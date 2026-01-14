import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';

// Common timezones for the US (primary market) + major international
export const COMMON_TIMEZONES = [
  // US Timezones
  { value: 'America/New_York', label: 'Eastern Time (ET)', abbr: 'ET' },
  { value: 'America/Chicago', label: 'Central Time (CT)', abbr: 'CT' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', abbr: 'MT' },
  { value: 'America/Phoenix', label: 'Arizona (MST)', abbr: 'MST' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', abbr: 'PT' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', abbr: 'AKT' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', abbr: 'HST' },
  // International
  { value: 'UTC', label: 'UTC', abbr: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)', abbr: 'GMT' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', abbr: 'CET' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', abbr: 'CET' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', abbr: 'JST' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)', abbr: 'CST' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', abbr: 'SGT' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', abbr: 'AEST' },
] as const;

export type TimezoneValue = typeof COMMON_TIMEZONES[number]['value'];

/**
 * Detect user's timezone from browser
 */
export function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/New_York'; // Fallback to ET
  }
}

/**
 * Get timezone label from value
 */
export function getTimezoneLabel(timezone: string): string {
  const found = COMMON_TIMEZONES.find((tz) => tz.value === timezone);
  return found?.label || timezone;
}

/**
 * Get timezone abbreviation
 */
export function getTimezoneAbbr(timezone: string): string {
  const found = COMMON_TIMEZONES.find((tz) => tz.value === timezone);
  return found?.abbr || timezone.split('/').pop() || timezone;
}

/**
 * Format a date/time in a specific timezone
 */
export function formatInTimezone(
  date: Date | string,
  timezone: string,
  formatStr: string = 'h:mm a'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, timezone, formatStr);
}

/**
 * Format a date with full timezone context
 * e.g., "Monday, January 15, 2024 at 2:00 PM ET"
 */
export function formatDateTimeWithTimezone(
  date: Date | string,
  timezone: string
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const abbr = getTimezoneAbbr(timezone);
  const formatted = formatInTimeZone(dateObj, timezone, 'EEEE, MMMM d, yyyy');
  const time = formatInTimeZone(dateObj, timezone, 'h:mm a');
  return `${formatted} at ${time} ${abbr}`;
}

/**
 * Format time range in a timezone
 * e.g., "2:00 PM - 2:30 PM ET"
 */
export function formatTimeRangeInTimezone(
  startDate: Date | string,
  endDate: Date | string,
  timezone: string
): string {
  const startObj = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const endObj = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  const abbr = getTimezoneAbbr(timezone);

  const startTime = formatInTimeZone(startObj, timezone, 'h:mm a');
  const endTime = formatInTimeZone(endObj, timezone, 'h:mm a');

  return `${startTime} - ${endTime} ${abbr}`;
}

/**
 * Format for calendar display (shows date if different from today)
 */
export function formatForCalendar(
  date: Date | string,
  timezone: string,
  showDate: boolean = true
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  if (showDate) {
    return formatInTimeZone(dateObj, timezone, 'EEE, MMM d · h:mm a');
  }
  return formatInTimeZone(dateObj, timezone, 'h:mm a');
}

/**
 * Convert a time from one timezone to another
 */
export function convertTimezone(
  date: Date | string,
  fromTimezone: string,
  toTimezone: string
): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  // Get the time in the source timezone
  const zonedDate = toZonedTime(dateObj, fromTimezone);

  // Convert to the target timezone
  return toZonedTime(zonedDate, toTimezone);
}

/**
 * Get the current time in a specific timezone
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Check if a timezone is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get UTC offset string for a timezone (e.g., "-05:00", "+09:00")
 */
export function getUTCOffset(timezone: string, date: Date = new Date()): string {
  const formatted = formatInTimeZone(date, timezone, 'xxx');
  return formatted;
}

/**
 * Get human-readable UTC offset (e.g., "UTC-5", "UTC+9")
 */
export function getReadableUTCOffset(timezone: string, date: Date = new Date()): string {
  const offset = getUTCOffset(timezone, date);
  const [hours, minutes] = offset.split(':').map(Number);

  if (hours === 0 && minutes === 0) {
    return 'UTC';
  }

  const sign = hours >= 0 ? '+' : '';
  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  }
  return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Format date for email (includes timezone context)
 */
export function formatForEmail(
  date: Date | string,
  timezone: string
): { date: string; time: string; timezone: string; full: string } {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const abbr = getTimezoneAbbr(timezone);

  return {
    date: formatInTimeZone(dateObj, timezone, 'EEEE, MMMM d, yyyy'),
    time: formatInTimeZone(dateObj, timezone, 'h:mm a'),
    timezone: abbr,
    full: formatDateTimeWithTimezone(dateObj, timezone),
  };
}

/**
 * Create timezone-aware slots for display
 * Takes UTC slots and converts them to display timezone
 */
export function formatSlotsForTimezone(
  slots: Array<{ start_time: string; end_time: string; [key: string]: unknown }>,
  displayTimezone: string
): Array<{
  start_time: string;
  end_time: string;
  display_start: string;
  display_end: string;
  display_date: string;
  display_time_range: string;
  [key: string]: unknown;
}> {
  return slots.map((slot) => {
    const startDate = parseISO(slot.start_time);
    const endDate = parseISO(slot.end_time);

    return {
      ...slot,
      display_start: formatInTimeZone(startDate, displayTimezone, 'h:mm a'),
      display_end: formatInTimeZone(endDate, displayTimezone, 'h:mm a'),
      display_date: formatInTimeZone(startDate, displayTimezone, 'EEEE, MMMM d'),
      display_time_range: formatTimeRangeInTimezone(startDate, endDate, displayTimezone),
    };
  });
}

/**
 * Group slots by date in a specific timezone
 */
export function groupSlotsByDate(
  slots: Array<{ start_time: string; [key: string]: unknown }>,
  timezone: string
): Map<string, Array<{ start_time: string; [key: string]: unknown }>> {
  const grouped = new Map<string, Array<{ start_time: string; [key: string]: unknown }>>();

  for (const slot of slots) {
    const dateKey = formatInTimeZone(parseISO(slot.start_time), timezone, 'yyyy-MM-dd');

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(slot);
  }

  return grouped;
}

/**
 * Get timezone options for a dropdown, sorted by offset
 */
export function getTimezoneOptions(): Array<{
  value: string;
  label: string;
  offset: string;
}> {
  const now = new Date();

  return COMMON_TIMEZONES.map((tz) => ({
    value: tz.value,
    label: tz.label,
    offset: getReadableUTCOffset(tz.value, now),
  })).sort((a, b) => {
    // Sort by UTC offset
    const offsetA = getUTCOffset(a.value, now);
    const offsetB = getUTCOffset(b.value, now);
    return offsetA.localeCompare(offsetB);
  });
}
