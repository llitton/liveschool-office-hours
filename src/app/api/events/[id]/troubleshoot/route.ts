import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAvailabilityPatterns, getBusyBlocks } from '@/lib/availability';
import { getParticipatingHosts } from '@/lib/round-robin';
import {
  addHours,
  addDays,
  addMinutes,
  parseISO,
  startOfDay,
  endOfDay,
  setHours,
  setMinutes,
  getDay,
  isBefore,
  isAfter,
  areIntervalsOverlapping,
  format,
} from 'date-fns';

// Reason codes for why a slot is unavailable
type ReasonCode =
  | 'AVAILABLE'
  | 'NOAVAILABILITY'
  | 'OUTSIDEHOURS'
  | 'CALENDAR'
  | 'TOOSOON'
  | 'TOOLATE'
  | 'BUFFER'
  | 'BOOKED'
  | 'DAILYMAX'
  | 'WEEKLYMAX'
  | 'NOCAL'
  | 'NOHOST'
  | 'PAST';

interface TroubleshootSlot {
  start_time: string;
  end_time: string;
  code: ReasonCode;
  reason: string;
  details?: string;
}

// GET troubleshoot availability for a specific date
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const dateStr = searchParams.get('date');

  if (!dateStr) {
    return NextResponse.json({ error: 'date parameter required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const targetDate = parseISO(dateStr);
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

  // Get the event details
  const { data: event, error: eventError } = await supabase
    .from('oh_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Get the host admin separately
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id, email, google_access_token, google_refresh_token, max_meetings_per_day, max_meetings_per_week')
    .eq('email', event.host_email)
    .single();

  if (!admin) {
    return NextResponse.json({
      date: dateStr,
      slots: [],
      summary: { code: 'NOHOST', reason: 'No host configured for this event' },
    });
  }

  // Calculate constraint boundaries
  const now = new Date();
  const minNoticeHours = event.min_notice_hours ?? 24;
  const bookingWindowDays = event.booking_window_days ?? 60;
  const earliestBookable = addHours(now, minNoticeHours);
  const latestBookable = addDays(now, bookingWindowDays);
  const bufferBefore = event.buffer_before || 0;
  const bufferAfter = event.buffer_after || 0;
  const startTimeIncrement = event.start_time_increment || 30;

  // For round-robin, get all participating hosts
  let hostIds: string[] = [admin.id];
  if (event.meeting_type === 'round_robin') {
    const participatingHosts = await getParticipatingHosts(eventId);
    if (participatingHosts.length > 0) {
      hostIds = participatingHosts;
    }
  }

  // Get availability patterns for all hosts
  const allPatterns = await Promise.all(
    hostIds.map(async (hostId) => ({
      hostId,
      patterns: await getAvailabilityPatterns(hostId),
    }))
  );

  // Check if any host has patterns for this day of week
  const dayOfWeek = getDay(targetDate);
  const hostsWithPatterns = allPatterns.filter(
    ({ patterns }) => patterns.some((p) => p.day_of_week === dayOfWeek)
  );

  // No host has availability for this day
  if (hostsWithPatterns.length === 0) {
    // Check if ANY patterns exist
    const anyPatterns = allPatterns.some(({ patterns }) => patterns.length > 0);

    return NextResponse.json({
      date: dateStr,
      day_of_week: dayOfWeek,
      slots: [],
      summary: anyPatterns
        ? { code: 'OUTSIDEHOURS', reason: `No availability configured for ${format(targetDate, 'EEEE')}s` }
        : { code: 'NOAVAILABILITY', reason: 'No weekly availability configured. Go to Settings to add your available hours.' },
    });
  }

  // Get busy blocks for all hosts
  const allBusyBlocks = await Promise.all(
    hostIds.map(async (hostId) => ({
      hostId,
      blocks: await getBusyBlocks(hostId, dayStart, dayEnd),
    }))
  );

  // Get existing bookings for the day
  const { data: existingSlots } = await supabase
    .from('oh_slots')
    .select('id, start_time, end_time, bookings:oh_bookings(count)')
    .eq('event_id', eventId)
    .eq('is_cancelled', false)
    .gte('start_time', dayStart.toISOString())
    .lte('end_time', dayEnd.toISOString());

  // Check calendar connection
  const calendarConnected = !!(admin.google_access_token && admin.google_refresh_token);

  // Get meeting counts for limit checks
  const { data: dailyMeetings } = await supabase
    .from('oh_slots')
    .select('id')
    .eq('is_cancelled', false)
    .gte('start_time', dayStart.toISOString())
    .lte('end_time', dayEnd.toISOString());

  const weekStart = addDays(dayStart, -getDay(dayStart));
  const weekEnd = addDays(weekStart, 7);
  const { data: weeklyMeetings } = await supabase
    .from('oh_slots')
    .select('id')
    .eq('is_cancelled', false)
    .gte('start_time', weekStart.toISOString())
    .lte('end_time', weekEnd.toISOString());

  const dailyCount = dailyMeetings?.length || 0;
  const weeklyCount = weeklyMeetings?.length || 0;
  const maxDaily = admin.max_meetings_per_day;
  const maxWeekly = admin.max_meetings_per_week;

  // Generate time slots for the day and analyze each one
  const troubleshootSlots: TroubleshootSlot[] = [];

  // Find earliest start and latest end from all patterns for this day
  let dayEarliestStart = 23;
  let dayLatestEnd = 0;

  for (const { patterns } of hostsWithPatterns) {
    for (const pattern of patterns.filter((p) => p.day_of_week === dayOfWeek)) {
      const [startHour] = pattern.start_time.split(':').map(Number);
      const [endHour, endMin] = pattern.end_time.split(':').map(Number);
      if (startHour < dayEarliestStart) dayEarliestStart = startHour;
      const endTime = endHour + (endMin > 0 ? 1 : 0);
      if (endTime > dayLatestEnd) dayLatestEnd = endTime;
    }
  }

  // Generate slots from earliest to latest
  let slotStart = setMinutes(setHours(targetDate, dayEarliestStart), 0);
  const dayEndTime = setMinutes(setHours(targetDate, dayLatestEnd), 0);

  while (isBefore(slotStart, dayEndTime)) {
    const slotEnd = addMinutes(slotStart, event.duration_minutes);
    const slot: TroubleshootSlot = {
      start_time: slotStart.toISOString(),
      end_time: slotEnd.toISOString(),
      code: 'AVAILABLE',
      reason: 'Available for booking',
    };

    // Check each reason in priority order

    // 1. Past time
    if (isBefore(slotStart, now)) {
      slot.code = 'PAST';
      slot.reason = 'This time has already passed';
    }
    // 2. Too soon (within minimum notice period)
    else if (isBefore(slotStart, earliestBookable)) {
      slot.code = 'TOOSOON';
      slot.reason = `Within ${minNoticeHours}-hour minimum notice period`;
      slot.details = `Earliest bookable: ${format(earliestBookable, 'h:mm a')}`;
    }
    // 3. Too late (outside booking window)
    else if (isAfter(slotStart, latestBookable)) {
      slot.code = 'TOOLATE';
      slot.reason = `Outside ${bookingWindowDays}-day booking window`;
    }
    // 4. Check if within any host's availability pattern
    else {
      let withinAnyPattern = false;
      let blockedByCalendar = true;
      let calendarBlockDetails = '';

      for (const { hostId, patterns } of hostsWithPatterns) {
        const dayPatterns = patterns.filter((p) => p.day_of_week === dayOfWeek);

        for (const pattern of dayPatterns) {
          const [patternStartHour, patternStartMin] = pattern.start_time.split(':').map(Number);
          const [patternEndHour, patternEndMin] = pattern.end_time.split(':').map(Number);

          const patternStart = setMinutes(setHours(targetDate, patternStartHour), patternStartMin);
          const patternEnd = setMinutes(setHours(targetDate, patternEndHour), patternEndMin);

          // Check if slot fits within this pattern
          if (
            (isAfter(slotStart, patternStart) || slotStart.getTime() === patternStart.getTime()) &&
            (isBefore(slotEnd, patternEnd) || slotEnd.getTime() === patternEnd.getTime())
          ) {
            withinAnyPattern = true;

            // Check calendar busy blocks for this host
            const hostBusy = allBusyBlocks.find((b) => b.hostId === hostId)?.blocks || [];
            const conflictsWithBusy = hostBusy.some((block) =>
              areIntervalsOverlapping(
                { start: slotStart, end: slotEnd },
                { start: parseISO(block.start_time), end: parseISO(block.end_time) }
              )
            );

            if (!conflictsWithBusy) {
              blockedByCalendar = false;
            } else {
              // Find the blocking event
              const blockingEvent = hostBusy.find((block) =>
                areIntervalsOverlapping(
                  { start: slotStart, end: slotEnd },
                  { start: parseISO(block.start_time), end: parseISO(block.end_time) }
                )
              );
              if (blockingEvent) {
                calendarBlockDetails = `Busy: ${format(parseISO(blockingEvent.start_time), 'h:mm a')} - ${format(parseISO(blockingEvent.end_time), 'h:mm a')}`;
              }
            }
          }
        }
      }

      if (!withinAnyPattern) {
        slot.code = 'OUTSIDEHOURS';
        slot.reason = 'Outside configured availability hours';
      } else if (blockedByCalendar) {
        if (!calendarConnected) {
          slot.code = 'NOCAL';
          slot.reason = 'Google Calendar not connected';
          slot.details = 'Connect your calendar in Settings to sync busy times';
        } else {
          slot.code = 'CALENDAR';
          slot.reason = 'Blocked by calendar event';
          slot.details = calendarBlockDetails;
        }
      }
      // 5. Check daily/weekly limits
      else if (maxDaily && dailyCount >= maxDaily) {
        slot.code = 'DAILYMAX';
        slot.reason = `Daily meeting limit reached (${maxDaily})`;
      } else if (maxWeekly && weeklyCount >= maxWeekly) {
        slot.code = 'WEEKLYMAX';
        slot.reason = `Weekly meeting limit reached (${maxWeekly})`;
      }
      // 6. Check existing bookings with buffers
      else {
        const conflictsWithBooking = (existingSlots || []).some((existing) => {
          const existingStart = bufferBefore > 0
            ? addMinutes(parseISO(existing.start_time), -bufferBefore)
            : parseISO(existing.start_time);
          const existingEnd = bufferAfter > 0
            ? addMinutes(parseISO(existing.end_time), bufferAfter)
            : parseISO(existing.end_time);

          return areIntervalsOverlapping(
            { start: slotStart, end: slotEnd },
            { start: existingStart, end: existingEnd }
          );
        });

        if (conflictsWithBooking) {
          // Check if it's a buffer or an actual booking
          const directConflict = (existingSlots || []).some((existing) =>
            areIntervalsOverlapping(
              { start: slotStart, end: slotEnd },
              { start: parseISO(existing.start_time), end: parseISO(existing.end_time) }
            )
          );

          if (directConflict) {
            slot.code = 'BOOKED';
            slot.reason = 'Already has a booking at this time';
          } else {
            slot.code = 'BUFFER';
            slot.reason = `Within buffer time of another meeting`;
            slot.details = `${bufferBefore}min before / ${bufferAfter}min after`;
          }
        }
      }
    }

    troubleshootSlots.push(slot);
    slotStart = addMinutes(slotStart, startTimeIncrement);
  }

  // Calculate summary stats
  const availableCount = troubleshootSlots.filter((s) => s.code === 'AVAILABLE').length;
  const blockedCount = troubleshootSlots.length - availableCount;

  // Determine main blocking reason
  const reasonCounts: Record<string, number> = {};
  for (const slot of troubleshootSlots) {
    if (slot.code !== 'AVAILABLE') {
      reasonCounts[slot.code] = (reasonCounts[slot.code] || 0) + 1;
    }
  }
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];

  return NextResponse.json({
    date: dateStr,
    day_of_week: dayOfWeek,
    day_name: format(targetDate, 'EEEE'),
    event: {
      name: event.name,
      duration_minutes: event.duration_minutes,
      meeting_type: event.meeting_type,
      min_notice_hours: minNoticeHours,
      booking_window_days: bookingWindowDays,
      buffer_before: bufferBefore,
      buffer_after: bufferAfter,
    },
    host: {
      calendar_connected: calendarConnected,
      max_meetings_per_day: maxDaily,
      max_meetings_per_week: maxWeekly,
      daily_count: dailyCount,
      weekly_count: weeklyCount,
    },
    slots: troubleshootSlots,
    summary: {
      total_slots: troubleshootSlots.length,
      available: availableCount,
      blocked: blockedCount,
      top_blocking_reason: topReason ? { code: topReason[0], count: topReason[1] } : null,
    },
  });
}
