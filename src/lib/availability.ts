import { getServiceSupabase } from './supabase';
import { getFreeBusy } from './google';
import type { OHAvailabilityPattern, OHBusyBlock } from '@/types';
import {
  addDays,
  addMinutes,
  parseISO,
  format,
  startOfDay,
  endOfDay,
  isBefore,
  isAfter,
  areIntervalsOverlapping,
  setHours,
  setMinutes,
  getDay,
} from 'date-fns';

interface TimeSlot {
  start: Date;
  end: Date;
}

/**
 * Sync busy blocks from Google Calendar for an admin
 */
export async function syncGoogleCalendarBusy(
  adminId: string,
  accessToken: string,
  refreshToken: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  const supabase = getServiceSupabase();

  // Fetch busy times from Google Calendar
  const busyTimes = await getFreeBusy(
    accessToken,
    refreshToken,
    startDate.toISOString(),
    endDate.toISOString()
  );

  // Delete existing busy blocks for this admin in this date range
  await supabase
    .from('oh_busy_blocks')
    .delete()
    .eq('admin_id', adminId)
    .eq('source', 'google_calendar')
    .gte('start_time', startDate.toISOString())
    .lte('end_time', endDate.toISOString());

  // Insert new busy blocks
  if (busyTimes.length > 0) {
    const blocks = busyTimes.map((block) => ({
      admin_id: adminId,
      start_time: block.start,
      end_time: block.end,
      source: 'google_calendar',
      synced_at: new Date().toISOString(),
    }));

    await supabase.from('oh_busy_blocks').insert(blocks);
  }
}

/**
 * Get availability patterns for an admin
 */
export async function getAvailabilityPatterns(
  adminId: string
): Promise<OHAvailabilityPattern[]> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_availability_patterns')
    .select('*')
    .eq('admin_id', adminId)
    .eq('is_active', true)
    .order('day_of_week', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get busy blocks for an admin within a date range
 */
export async function getBusyBlocks(
  adminId: string,
  startDate: Date,
  endDate: Date
): Promise<OHBusyBlock[]> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_busy_blocks')
    .select('*')
    .eq('admin_id', adminId)
    .gte('start_time', startDate.toISOString())
    .lte('end_time', endDate.toISOString());

  if (error) throw error;
  return data || [];
}

/**
 * Get existing slots for an admin/event within a date range
 */
async function getExistingSlots(
  adminId: string | null,
  eventId: string | null,
  startDate: Date,
  endDate: Date
): Promise<TimeSlot[]> {
  const supabase = getServiceSupabase();

  let query = supabase
    .from('oh_slots')
    .select('start_time, end_time, event:oh_events(host_email)')
    .eq('is_cancelled', false)
    .gte('start_time', startDate.toISOString())
    .lte('end_time', endDate.toISOString());

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((slot) => ({
    start: parseISO(slot.start_time),
    end: parseISO(slot.end_time),
  }));
}

/**
 * Check if a specific time slot is available for an admin
 */
export async function checkTimeAvailability(
  adminId: string,
  startTime: Date,
  endTime: Date,
  eventId?: string,
  bufferBefore: number = 0,
  bufferAfter: number = 0
): Promise<{ available: boolean; reason?: string }> {
  const supabase = getServiceSupabase();

  // Add buffer to the check window
  const checkStart = bufferBefore > 0 ? addMinutes(startTime, -bufferBefore) : startTime;
  const checkEnd = bufferAfter > 0 ? addMinutes(endTime, bufferAfter) : endTime;

  // Get admin's availability patterns for this day
  const dayOfWeek = getDay(startTime);
  const patterns = await getAvailabilityPatterns(adminId);
  const dayPatterns = patterns.filter((p) => p.day_of_week === dayOfWeek);

  // Check if time falls within an availability pattern
  if (dayPatterns.length > 0) {
    const timeStr = format(startTime, 'HH:mm:ss');
    const endTimeStr = format(endTime, 'HH:mm:ss');
    const isWithinPattern = dayPatterns.some((pattern) => {
      return timeStr >= pattern.start_time && endTimeStr <= pattern.end_time;
    });

    if (!isWithinPattern) {
      return {
        available: false,
        reason: 'Outside of set availability hours',
      };
    }
  }

  // Check against busy blocks
  const busyBlocks = await getBusyBlocks(
    adminId,
    startOfDay(startTime),
    endOfDay(startTime)
  );

  for (const block of busyBlocks) {
    const blockStart = parseISO(block.start_time);
    const blockEnd = parseISO(block.end_time);

    if (
      areIntervalsOverlapping(
        { start: checkStart, end: checkEnd },
        { start: blockStart, end: blockEnd }
      )
    ) {
      return {
        available: false,
        reason: 'Conflicts with calendar event',
      };
    }
  }

  // Check against existing slots (including buffer)
  const existingSlots = await getExistingSlots(
    adminId,
    eventId || null,
    startOfDay(startTime),
    endOfDay(startTime)
  );

  for (const slot of existingSlots) {
    // Apply buffer around existing slots as well
    const slotStart = bufferBefore > 0 ? addMinutes(slot.start, -bufferBefore) : slot.start;
    const slotEnd = bufferAfter > 0 ? addMinutes(slot.end, bufferAfter) : slot.end;

    if (
      areIntervalsOverlapping(
        { start: checkStart, end: checkEnd },
        { start: slotStart, end: slotEnd }
      )
    ) {
      return {
        available: false,
        reason: 'Conflicts with existing slot',
      };
    }
  }

  return { available: true };
}

/**
 * Generate available time slots for an admin based on their patterns
 */
export async function getAvailableSlots(
  adminId: string,
  eventDurationMinutes: number,
  bufferBefore: number,
  bufferAfter: number,
  startDate: Date,
  endDate: Date,
  eventId?: string
): Promise<TimeSlot[]> {
  const patterns = await getAvailabilityPatterns(adminId);
  const busyBlocks = await getBusyBlocks(adminId, startDate, endDate);
  const existingSlots = await getExistingSlots(adminId, eventId || null, startDate, endDate);

  const availableSlots: TimeSlot[] = [];
  let currentDate = startOfDay(startDate);

  while (isBefore(currentDate, endDate)) {
    const dayOfWeek = getDay(currentDate);
    const dayPatterns = patterns.filter((p) => p.day_of_week === dayOfWeek);

    for (const pattern of dayPatterns) {
      // Parse pattern times
      const [startHour, startMin] = pattern.start_time.split(':').map(Number);
      const [endHour, endMin] = pattern.end_time.split(':').map(Number);

      let slotStart = setMinutes(setHours(currentDate, startHour), startMin);
      const patternEnd = setMinutes(setHours(currentDate, endHour), endMin);

      // Generate slots within this pattern
      while (isBefore(addMinutes(slotStart, eventDurationMinutes), patternEnd) ||
             slotStart.getTime() + eventDurationMinutes * 60000 <= patternEnd.getTime()) {
        const slotEnd = addMinutes(slotStart, eventDurationMinutes);

        // Check if slot is in the past
        if (isBefore(slotStart, new Date())) {
          slotStart = addMinutes(slotStart, 30); // Move in 30-min increments
          continue;
        }

        // Check if slot conflicts with busy blocks
        const conflictsWithBusy = busyBlocks.some((block) =>
          areIntervalsOverlapping(
            { start: slotStart, end: slotEnd },
            { start: parseISO(block.start_time), end: parseISO(block.end_time) }
          )
        );

        // Check if slot conflicts with existing slots (including buffer)
        const conflictsWithSlot = existingSlots.some((existing) => {
          const existingStart = bufferBefore > 0
            ? addMinutes(existing.start, -bufferBefore)
            : existing.start;
          const existingEnd = bufferAfter > 0
            ? addMinutes(existing.end, bufferAfter)
            : existing.end;
          return areIntervalsOverlapping(
            { start: slotStart, end: slotEnd },
            { start: existingStart, end: existingEnd }
          );
        });

        if (!conflictsWithBusy && !conflictsWithSlot) {
          availableSlots.push({ start: slotStart, end: slotEnd });
        }

        slotStart = addMinutes(slotStart, 30); // Move in 30-min increments
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  return availableSlots;
}

/**
 * Check if ALL hosts are available at a specific time (for collective events)
 */
export async function checkCollectiveAvailability(
  hostIds: string[],
  startTime: Date,
  endTime: Date,
  eventId?: string
): Promise<{ available: boolean; unavailableHosts: string[]; reasons: Record<string, string> }> {
  const unavailableHosts: string[] = [];
  const reasons: Record<string, string> = {};

  // Check each host's availability
  for (const hostId of hostIds) {
    const result = await checkTimeAvailability(hostId, startTime, endTime, eventId);
    if (!result.available) {
      unavailableHosts.push(hostId);
      reasons[hostId] = result.reason || 'Not available';
    }
  }

  return {
    available: unavailableHosts.length === 0,
    unavailableHosts,
    reasons,
  };
}

/**
 * Get available slots where ALL hosts are free (for collective events)
 */
export async function getCollectiveAvailableSlots(
  hostIds: string[],
  eventDurationMinutes: number,
  startDate: Date,
  endDate: Date,
  eventId?: string
): Promise<TimeSlot[]> {
  if (hostIds.length === 0) {
    return [];
  }

  // Get availability data for all hosts
  const allPatterns = await Promise.all(
    hostIds.map((id) => getAvailabilityPatterns(id))
  );
  const allBusyBlocks = await Promise.all(
    hostIds.map((id) => getBusyBlocks(id, startDate, endDate))
  );
  const allExistingSlots = await Promise.all(
    hostIds.map((id) => getExistingSlots(id, eventId || null, startDate, endDate))
  );

  const availableSlots: TimeSlot[] = [];
  let currentDate = startOfDay(startDate);

  while (isBefore(currentDate, endDate)) {
    const dayOfWeek = getDay(currentDate);

    // Find the intersection of all hosts' patterns for this day
    const hostDayPatterns = allPatterns.map((patterns) =>
      patterns.filter((p) => p.day_of_week === dayOfWeek)
    );

    // Skip if any host has no availability on this day
    if (hostDayPatterns.some((patterns) => patterns.length === 0)) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    // Find common available windows
    // Start with the first host's patterns and narrow down
    let commonWindows: { start: string; end: string }[] = hostDayPatterns[0].map((p) => ({
      start: p.start_time,
      end: p.end_time,
    }));

    // Intersect with each subsequent host's patterns
    for (let i = 1; i < hostDayPatterns.length; i++) {
      const hostWindows = hostDayPatterns[i].map((p) => ({
        start: p.start_time,
        end: p.end_time,
      }));

      // Calculate intersection
      const newCommon: { start: string; end: string }[] = [];
      for (const w1 of commonWindows) {
        for (const w2 of hostWindows) {
          const intersectStart = w1.start > w2.start ? w1.start : w2.start;
          const intersectEnd = w1.end < w2.end ? w1.end : w2.end;
          if (intersectStart < intersectEnd) {
            newCommon.push({ start: intersectStart, end: intersectEnd });
          }
        }
      }
      commonWindows = newCommon;
    }

    // Generate slots within common windows
    for (const window of commonWindows) {
      const [startHour, startMin] = window.start.split(':').map(Number);
      const [endHour, endMin] = window.end.split(':').map(Number);

      let slotStart = setMinutes(setHours(currentDate, startHour), startMin);
      const windowEnd = setMinutes(setHours(currentDate, endHour), endMin);

      while (
        isBefore(addMinutes(slotStart, eventDurationMinutes), windowEnd) ||
        slotStart.getTime() + eventDurationMinutes * 60000 <= windowEnd.getTime()
      ) {
        const slotEnd = addMinutes(slotStart, eventDurationMinutes);

        // Skip if in the past
        if (isBefore(slotStart, new Date())) {
          slotStart = addMinutes(slotStart, 30);
          continue;
        }

        // Check if this slot conflicts with ANY host's busy blocks or existing slots
        let hasConflict = false;

        for (let i = 0; i < hostIds.length; i++) {
          // Check busy blocks
          const conflictsWithBusy = allBusyBlocks[i].some((block) =>
            areIntervalsOverlapping(
              { start: slotStart, end: slotEnd },
              { start: parseISO(block.start_time), end: parseISO(block.end_time) }
            )
          );

          if (conflictsWithBusy) {
            hasConflict = true;
            break;
          }

          // Check existing slots
          const conflictsWithSlot = allExistingSlots[i].some((existing) =>
            areIntervalsOverlapping(
              { start: slotStart, end: slotEnd },
              { start: existing.start, end: existing.end }
            )
          );

          if (conflictsWithSlot) {
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
          availableSlots.push({ start: slotStart, end: slotEnd });
        }

        slotStart = addMinutes(slotStart, 30);
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  return availableSlots;
}

/**
 * Generate suggested slots based on availability patterns for a given week
 */
export async function generateSlotsFromPatterns(
  adminId: string,
  eventDurationMinutes: number,
  bufferBefore: number,
  bufferAfter: number,
  weekStartDate: Date
): Promise<TimeSlot[]> {
  const weekEndDate = addDays(weekStartDate, 7);
  return getAvailableSlots(
    adminId,
    eventDurationMinutes,
    bufferBefore,
    bufferAfter,
    weekStartDate,
    weekEndDate
  );
}
