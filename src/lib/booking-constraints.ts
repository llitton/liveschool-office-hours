import { getServiceSupabase } from './supabase';
import type { OHEvent, OHAdmin } from '@/types';
import {
  addHours,
  addDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  parseISO,
  isBefore,
  isAfter,
  differenceInHours,
} from 'date-fns';

export interface ConstraintValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BookingConstraints {
  minNoticeHours: number;
  maxDailyBookings: number | null;
  maxWeeklyBookings: number | null;
  bookingWindowDays: number;
  requireApproval: boolean;
  adminMaxDaily: number;
  adminMaxWeekly: number;
}

/**
 * Get the booking constraints for an event
 */
export function getEventConstraints(
  event: OHEvent,
  admin?: OHAdmin | null
): BookingConstraints {
  return {
    minNoticeHours: event.min_notice_hours ?? 24,
    maxDailyBookings: event.max_daily_bookings,
    maxWeeklyBookings: event.max_weekly_bookings,
    bookingWindowDays: event.booking_window_days ?? 60,
    requireApproval: event.require_approval ?? false,
    adminMaxDaily: admin?.max_meetings_per_day ?? 8,
    adminMaxWeekly: admin?.max_meetings_per_week ?? 30,
  };
}

/**
 * Validate minimum notice requirement
 */
export function validateMinNotice(
  slotStartTime: Date,
  minNoticeHours: number
): { valid: boolean; error?: string } {
  const now = new Date();
  const minBookingTime = addHours(now, minNoticeHours);

  if (isBefore(slotStartTime, minBookingTime)) {
    const hoursUntilSlot = differenceInHours(slotStartTime, now);
    return {
      valid: false,
      error: `This slot requires ${minNoticeHours} hours notice. The slot is only ${hoursUntilSlot} hours away.`,
    };
  }

  return { valid: true };
}

/**
 * Validate booking window (how far in advance can book)
 */
export function validateBookingWindow(
  slotStartTime: Date,
  bookingWindowDays: number
): { valid: boolean; error?: string } {
  const now = new Date();
  const maxBookingDate = addDays(now, bookingWindowDays);

  if (isAfter(slotStartTime, maxBookingDate)) {
    return {
      valid: false,
      error: `Bookings can only be made up to ${bookingWindowDays} days in advance.`,
    };
  }

  return { valid: true };
}

/**
 * Count bookings for an event on a specific day
 */
async function countDailyBookings(
  eventId: string,
  date: Date
): Promise<number> {
  const supabase = getServiceSupabase();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const { count, error } = await supabase
    .from('oh_bookings')
    .select('id, slot:oh_slots!inner(event_id, start_time)', { count: 'exact', head: true })
    .eq('slot.event_id', eventId)
    .gte('slot.start_time', dayStart.toISOString())
    .lte('slot.start_time', dayEnd.toISOString())
    .is('cancelled_at', null);

  if (error) {
    console.error('Error counting daily bookings:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Count bookings for an event in a week
 */
async function countWeeklyBookings(
  eventId: string,
  date: Date
): Promise<number> {
  const supabase = getServiceSupabase();
  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });

  const { count, error } = await supabase
    .from('oh_bookings')
    .select('id, slot:oh_slots!inner(event_id, start_time)', { count: 'exact', head: true })
    .eq('slot.event_id', eventId)
    .gte('slot.start_time', weekStart.toISOString())
    .lte('slot.start_time', weekEnd.toISOString())
    .is('cancelled_at', null);

  if (error) {
    console.error('Error counting weekly bookings:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Count total meetings for an admin on a specific day
 */
async function countAdminDailyMeetings(
  adminEmail: string,
  date: Date
): Promise<number> {
  const supabase = getServiceSupabase();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const { count, error } = await supabase
    .from('oh_slots')
    .select('id, event:oh_events!inner(host_email)', { count: 'exact', head: true })
    .eq('event.host_email', adminEmail)
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())
    .eq('is_cancelled', false);

  if (error) {
    console.error('Error counting admin daily meetings:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Count total meetings for an admin in a week
 */
async function countAdminWeeklyMeetings(
  adminEmail: string,
  date: Date
): Promise<number> {
  const supabase = getServiceSupabase();
  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });

  const { count, error } = await supabase
    .from('oh_slots')
    .select('id, event:oh_events!inner(host_email)', { count: 'exact', head: true })
    .eq('event.host_email', adminEmail)
    .gte('start_time', weekStart.toISOString())
    .lte('start_time', weekEnd.toISOString())
    .eq('is_cancelled', false);

  if (error) {
    console.error('Error counting admin weekly meetings:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Validate daily booking limits
 */
export async function validateDailyLimit(
  eventId: string,
  slotStartTime: Date,
  maxDailyBookings: number | null
): Promise<{ valid: boolean; error?: string }> {
  if (maxDailyBookings === null) {
    return { valid: true };
  }

  const currentCount = await countDailyBookings(eventId, slotStartTime);

  if (currentCount >= maxDailyBookings) {
    return {
      valid: false,
      error: `This event has reached its daily booking limit of ${maxDailyBookings}.`,
    };
  }

  return { valid: true };
}

/**
 * Validate weekly booking limits
 */
export async function validateWeeklyLimit(
  eventId: string,
  slotStartTime: Date,
  maxWeeklyBookings: number | null
): Promise<{ valid: boolean; error?: string }> {
  if (maxWeeklyBookings === null) {
    return { valid: true };
  }

  const currentCount = await countWeeklyBookings(eventId, slotStartTime);

  if (currentCount >= maxWeeklyBookings) {
    return {
      valid: false,
      error: `This event has reached its weekly booking limit of ${maxWeeklyBookings}.`,
    };
  }

  return { valid: true };
}

/**
 * Validate admin's personal meeting limits
 */
export async function validateAdminLimits(
  adminEmail: string,
  slotStartTime: Date,
  maxDaily: number,
  maxWeekly: number
): Promise<{ valid: boolean; error?: string; warning?: string }> {
  const dailyCount = await countAdminDailyMeetings(adminEmail, slotStartTime);
  const weeklyCount = await countAdminWeeklyMeetings(adminEmail, slotStartTime);

  if (dailyCount >= maxDaily) {
    return {
      valid: false,
      error: `The host has reached their daily meeting limit.`,
    };
  }

  if (weeklyCount >= maxWeekly) {
    return {
      valid: false,
      error: `The host has reached their weekly meeting limit.`,
    };
  }

  // Warnings for approaching limits
  let warning: string | undefined;
  if (dailyCount >= maxDaily - 1) {
    warning = 'This is the host\'s last available slot for today.';
  } else if (weeklyCount >= maxWeekly - 2) {
    warning = 'The host is approaching their weekly meeting limit.';
  }

  return { valid: true, warning };
}

/**
 * Validate all booking constraints for a slot
 */
export async function validateBookingConstraints(
  event: OHEvent,
  slotStartTime: Date | string,
  admin?: OHAdmin | null
): Promise<ConstraintValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const startTime = typeof slotStartTime === 'string' ? parseISO(slotStartTime) : slotStartTime;
  const constraints = getEventConstraints(event, admin);

  // 1. Validate minimum notice
  const minNoticeResult = validateMinNotice(startTime, constraints.minNoticeHours);
  if (!minNoticeResult.valid && minNoticeResult.error) {
    errors.push(minNoticeResult.error);
  }

  // 2. Validate booking window
  const windowResult = validateBookingWindow(startTime, constraints.bookingWindowDays);
  if (!windowResult.valid && windowResult.error) {
    errors.push(windowResult.error);
  }

  // 3. Validate daily limit (if set)
  const dailyResult = await validateDailyLimit(
    event.id,
    startTime,
    constraints.maxDailyBookings
  );
  if (!dailyResult.valid && dailyResult.error) {
    errors.push(dailyResult.error);
  }

  // 4. Validate weekly limit (if set)
  const weeklyResult = await validateWeeklyLimit(
    event.id,
    startTime,
    constraints.maxWeeklyBookings
  );
  if (!weeklyResult.valid && weeklyResult.error) {
    errors.push(weeklyResult.error);
  }

  // 5. Validate admin's personal limits
  const adminResult = await validateAdminLimits(
    event.host_email,
    startTime,
    constraints.adminMaxDaily,
    constraints.adminMaxWeekly
  );
  if (!adminResult.valid && adminResult.error) {
    errors.push(adminResult.error);
  }
  if (adminResult.warning) {
    warnings.push(adminResult.warning);
  }

  // 6. Add approval warning if required
  if (constraints.requireApproval) {
    warnings.push('This booking will require approval from the host before confirmation.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Filter available slots based on constraints
 * Use this when generating slot list for booking page
 */
export async function filterSlotsByConstraints(
  event: OHEvent,
  slots: Array<{ start_time: string; end_time: string }>,
  admin?: OHAdmin | null
): Promise<Array<{ start_time: string; end_time: string; warnings: string[] }>> {
  const constraints = getEventConstraints(event, admin);
  const now = new Date();
  const minBookingTime = addHours(now, constraints.minNoticeHours);
  const maxBookingDate = addDays(now, constraints.bookingWindowDays);

  const validSlots: Array<{ start_time: string; end_time: string; warnings: string[] }> = [];

  for (const slot of slots) {
    const startTime = parseISO(slot.start_time);

    // Quick checks without DB queries
    if (isBefore(startTime, minBookingTime)) {
      continue; // Skip slots that don't meet min notice
    }

    if (isAfter(startTime, maxBookingDate)) {
      continue; // Skip slots outside booking window
    }

    // Full validation for remaining slots
    const validation = await validateBookingConstraints(event, startTime, admin);

    if (validation.valid) {
      validSlots.push({
        ...slot,
        warnings: validation.warnings,
      });
    }
  }

  return validSlots;
}

/**
 * Get human-readable constraint summary for display
 */
export function getConstraintSummary(constraints: BookingConstraints): string[] {
  const summary: string[] = [];

  if (constraints.minNoticeHours > 0) {
    if (constraints.minNoticeHours >= 24) {
      const days = Math.floor(constraints.minNoticeHours / 24);
      summary.push(`Book at least ${days} day${days > 1 ? 's' : ''} in advance`);
    } else {
      summary.push(`Book at least ${constraints.minNoticeHours} hours in advance`);
    }
  }

  if (constraints.bookingWindowDays < 365) {
    summary.push(`Book up to ${constraints.bookingWindowDays} days ahead`);
  }

  if (constraints.maxDailyBookings) {
    summary.push(`Max ${constraints.maxDailyBookings} booking${constraints.maxDailyBookings > 1 ? 's' : ''} per day`);
  }

  if (constraints.maxWeeklyBookings) {
    summary.push(`Max ${constraints.maxWeeklyBookings} booking${constraints.maxWeeklyBookings > 1 ? 's' : ''} per week`);
  }

  if (constraints.requireApproval) {
    summary.push('Requires host approval');
  }

  return summary;
}
