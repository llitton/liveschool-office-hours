import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession, getHostWithTokens } from '@/lib/auth';
import { getFreeBusy } from '@/lib/google';
import { addDays, parseISO, startOfDay, endOfDay } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const DEFAULT_TIMEZONE = 'America/New_York';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TimeBlock {
  start: string; // HH:mm format
  end: string;
  type: 'busy' | 'slot' | 'available';
  title?: string;
  slotId?: string;
  hostName?: string; // For co-host busy times
}

interface DaySchedule {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  blocks: TimeBlock[];
  availableWindows: { start: string; end: string }[];
  hasAvailabilityPatterns: boolean;
}

// GET busy times, existing slots, and availability for a full week
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await getSession();
    if (!session) throw new Error('Not authenticated');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const weekStartStr = searchParams.get('weekStart');
  const eventId = searchParams.get('eventId');
  const coHostIdsParam = searchParams.get('coHostIds'); // Comma-separated co-host IDs

  if (!weekStartStr) {
    return NextResponse.json({ error: 'weekStart parameter is required (YYYY-MM-DD)' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Parse co-host IDs if provided
  const coHostIds = coHostIdsParam ? coHostIdsParam.split(',').filter(Boolean) : [];
  const allHostIds = [session.id, ...coHostIds];

  // Get admin's timezone from their availability patterns (or use default)
  const { data: tzPattern } = await supabase
    .from('oh_availability_patterns')
    .select('timezone')
    .eq('admin_id', session.id)
    .limit(1)
    .single();

  const timezone = tzPattern?.timezone || DEFAULT_TIMEZONE;

  // Calculate week boundaries
  const weekStart = parseISO(weekStartStr);
  const weekEnd = addDays(weekStart, 6); // 7 days total (inclusive)

  // Get all hosts' info (for names and tokens)
  const { data: allHosts } = await supabase
    .from('oh_admins')
    .select('id, name, email, google_access_token, google_refresh_token')
    .in('id', allHostIds);

  // Create a map of host info for quick lookup
  const hostMap = new Map(allHosts?.map(h => [h.id, h]) || []);

  // Fetch Google Calendar busy times for ALL hosts
  const busyTimes: Array<{ start: string; end: string; hostId?: string; hostName?: string }> = [];

  for (const hostId of allHostIds) {
    const host = hostMap.get(hostId);
    if (host?.google_access_token && host?.google_refresh_token) {
      try {
        // Refresh tokens if needed
        const refreshedHost = await getHostWithTokens(hostId);
        if (refreshedHost?.google_access_token && refreshedHost?.google_refresh_token) {
          const weekBusy = await getFreeBusy(
            refreshedHost.google_access_token,
            refreshedHost.google_refresh_token,
            startOfDay(weekStart).toISOString(),
            endOfDay(weekEnd).toISOString()
          );
          // Tag busy times with host info (only for co-hosts, not primary)
          const hostName = host.name || host.email.split('@')[0];
          weekBusy.forEach(busy => {
            busyTimes.push({
              ...busy,
              hostId: coHostIds.includes(hostId) ? hostId : undefined,
              hostName: coHostIds.includes(hostId) ? hostName : undefined,
            });
          });
        }
      } catch (err) {
        console.error(`Failed to fetch Google Calendar for host ${hostId}:`, err);
      }
    }
  }

  // Get co-host names for the response
  const coHostNames = coHostIds
    .map(id => hostMap.get(id))
    .filter(Boolean)
    .map(h => h!.name || h!.email.split('@')[0]);

  // Fetch existing OH slots for this week
  let slotsQuery = supabase
    .from('oh_slots')
    .select('id, start_time, end_time, event:oh_events(name)')
    .gte('start_time', startOfDay(weekStart).toISOString())
    .lte('start_time', endOfDay(weekEnd).toISOString())
    .eq('is_cancelled', false);

  if (eventId) {
    // Exclude this event's slots (we want to see OTHER conflicts)
    slotsQuery = slotsQuery.neq('event_id', eventId);
  }

  const { data: existingSlots } = await slotsQuery;

  // Fetch all active availability patterns for this admin
  const { data: allPatterns } = await supabase
    .from('oh_availability_patterns')
    .select('day_of_week, start_time, end_time')
    .eq('admin_id', session.id)
    .eq('is_active', true);

  // Group patterns by day of week for quick lookup
  const patternsByDay: Record<number, Array<{ start_time: string; end_time: string }>> = {};
  if (allPatterns) {
    allPatterns.forEach((pattern) => {
      if (!patternsByDay[pattern.day_of_week]) {
        patternsByDay[pattern.day_of_week] = [];
      }
      patternsByDay[pattern.day_of_week].push({
        start_time: pattern.start_time,
        end_time: pattern.end_time,
      });
    });
  }

  // Build day schedules for each day of the week
  const days: DaySchedule[] = [];

  for (let i = 0; i < 7; i++) {
    const currentDate = addDays(weekStart, i);
    const dateStr = formatInTimeZone(currentDate, timezone, 'yyyy-MM-dd');
    const dayOfWeek = toZonedTime(currentDate, timezone).getDay();

    const blocks: TimeBlock[] = [];

    // Add busy blocks for this day
    busyTimes.forEach((busy) => {
      const startTime = new Date(busy.start);
      const endTime = new Date(busy.end);

      // Only include if it overlaps with this day (in the admin's timezone)
      const startInTz = formatInTimeZone(startTime, timezone, 'yyyy-MM-dd');
      const endInTz = formatInTimeZone(endTime, timezone, 'yyyy-MM-dd');

      if (startInTz === dateStr || endInTz === dateStr) {
        // Clamp to this day's boundaries if event spans multiple days
        let blockStart = formatInTimeZone(startTime, timezone, 'HH:mm');
        let blockEnd = formatInTimeZone(endTime, timezone, 'HH:mm');

        if (startInTz < dateStr) blockStart = '00:00';
        if (endInTz > dateStr) blockEnd = '23:59';

        // Show host name for co-host busy times
        const title = busy.hostName ? `${busy.hostName} busy` : 'Calendar event';

        blocks.push({
          start: blockStart,
          end: blockEnd,
          type: 'busy',
          title,
          hostName: busy.hostName,
        });
      }
    });

    // Add existing slots for this day
    if (existingSlots) {
      existingSlots.forEach((slot) => {
        const startTime = new Date(slot.start_time);
        const slotDateStr = formatInTimeZone(startTime, timezone, 'yyyy-MM-dd');

        if (slotDateStr === dateStr) {
          const endTime = new Date(slot.end_time);
          const eventName = slot.event && typeof slot.event === 'object' && 'name' in slot.event
            ? (slot.event as { name: string }).name
            : 'Session';

          blocks.push({
            start: formatInTimeZone(startTime, timezone, 'HH:mm'),
            end: formatInTimeZone(endTime, timezone, 'HH:mm'),
            type: 'slot',
            title: eventName,
            slotId: slot.id,
          });
        }
      });
    }

    // Build available windows based on patterns for this day
    const availableWindows: { start: string; end: string }[] = [];
    const dayPatterns = patternsByDay[dayOfWeek] || [];
    dayPatterns.forEach((pattern) => {
      availableWindows.push({
        start: pattern.start_time.slice(0, 5), // Convert HH:mm:ss to HH:mm
        end: pattern.end_time.slice(0, 5),
      });
    });

    // Sort blocks by start time
    blocks.sort((a, b) => a.start.localeCompare(b.start));

    days.push({
      date: dateStr,
      dayOfWeek: DAY_NAMES[dayOfWeek],
      blocks,
      availableWindows,
      hasAvailabilityPatterns: dayPatterns.length > 0,
    });
  }

  return NextResponse.json({
    weekStart: weekStartStr,
    weekEnd: formatInTimeZone(weekEnd, timezone, 'yyyy-MM-dd'),
    timezone,
    days,
    // Include co-host info when showing combined availability
    coHostNames: coHostNames.length > 0 ? coHostNames : undefined,
    showingCombinedAvailability: coHostIds.length > 0,
  });
}
