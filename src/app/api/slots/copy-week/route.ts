import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth, getHostWithTokens } from '@/lib/auth';
import { createCalendarEvent, getFreeBusy } from '@/lib/google';
import { getParticipatingHosts } from '@/lib/round-robin';
import { parseISO, format, addDays, startOfWeek, endOfWeek, startOfDay, endOfDay, areIntervalsOverlapping, differenceInDays } from 'date-fns';

// POST - Copy slots from one week to another
export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { event_id, source_week_start, target_week_start } = body;

  if (!event_id || !source_week_start || !target_week_start) {
    return NextResponse.json(
      { error: 'event_id, source_week_start, and target_week_start are required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get the event details
  const { data: event, error: eventError } = await supabase
    .from('oh_events')
    .select('*')
    .eq('id', event_id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Parse the week dates
  const sourceStart = startOfWeek(parseISO(source_week_start), { weekStartsOn: 0 });
  const sourceEnd = endOfWeek(sourceStart, { weekStartsOn: 0 });
  const targetStart = startOfWeek(parseISO(target_week_start), { weekStartsOn: 0 });

  // Calculate the day offset between source and target weeks
  const dayOffset = differenceInDays(targetStart, sourceStart);

  // Get slots from the source week
  const { data: sourceSlots, error: slotsError } = await supabase
    .from('oh_slots')
    .select('*')
    .eq('event_id', event_id)
    .eq('is_cancelled', false)
    .gte('start_time', sourceStart.toISOString())
    .lte('start_time', sourceEnd.toISOString())
    .order('start_time', { ascending: true });

  if (slotsError) {
    return NextResponse.json({ error: slotsError.message }, { status: 500 });
  }

  if (!sourceSlots || sourceSlots.length === 0) {
    return NextResponse.json(
      { error: 'No slots found in the source week' },
      { status: 400 }
    );
  }

  // Get existing slots in the target week to check for conflicts
  const targetEnd = endOfWeek(targetStart, { weekStartsOn: 0 });
  const { data: existingSlots } = await supabase
    .from('oh_slots')
    .select('id, start_time, end_time')
    .eq('event_id', event_id)
    .eq('is_cancelled', false)
    .gte('start_time', targetStart.toISOString())
    .lte('start_time', targetEnd.toISOString());

  // Get host tokens for calendar creation
  let hostAdmin = null;
  if (event.host_id) {
    hostAdmin = await getHostWithTokens(event.host_id);
  }
  if (!hostAdmin) {
    const { data: sessionAdmin } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', session.email)
      .single();
    hostAdmin = sessionAdmin;
  }

  const bufferBefore = event.buffer_before || 0;
  const bufferAfter = event.buffer_after || 0;

  const results = {
    created: [] as Array<{ start_time: string; end_time: string }>,
    skipped: [] as Array<{ start_time: string; reason: string }>,
  };

  // Process each source slot
  for (const sourceSlot of sourceSlots) {
    const sourceStartTime = parseISO(sourceSlot.start_time);
    const sourceEndTime = parseISO(sourceSlot.end_time);

    // Calculate target times by adding the day offset
    const targetStartTime = addDays(sourceStartTime, dayOffset);
    const targetEndTime = addDays(sourceEndTime, dayOffset);

    // Skip if target time is in the past
    if (targetStartTime < new Date()) {
      results.skipped.push({
        start_time: targetStartTime.toISOString(),
        reason: 'Time is in the past',
      });
      continue;
    }

    // Check for conflicts with existing slots in target week
    let hasConflict = false;
    for (const existing of existingSlots || []) {
      const existingStart = parseISO(existing.start_time);
      const existingEnd = parseISO(existing.end_time);

      if (
        areIntervalsOverlapping(
          { start: targetStartTime, end: targetEndTime },
          { start: existingStart, end: existingEnd }
        )
      ) {
        hasConflict = true;
        break;
      }
    }

    if (hasConflict) {
      results.skipped.push({
        start_time: targetStartTime.toISOString(),
        reason: 'Conflicts with existing slot',
      });
      continue;
    }

    // Check calendar availability if we have tokens
    if (hostAdmin?.google_access_token && hostAdmin?.google_refresh_token) {
      try {
        const dayStart = startOfDay(targetStartTime);
        const dayEnd = endOfDay(targetStartTime);

        const busyTimes = await getFreeBusy(
          hostAdmin.google_access_token,
          hostAdmin.google_refresh_token,
          dayStart.toISOString(),
          dayEnd.toISOString()
        );

        let calendarConflict = false;
        for (const busy of busyTimes) {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);

          if (
            areIntervalsOverlapping(
              { start: targetStartTime, end: targetEndTime },
              { start: busyStart, end: busyEnd }
            )
          ) {
            calendarConflict = true;
            break;
          }
        }

        if (calendarConflict) {
          results.skipped.push({
            start_time: targetStartTime.toISOString(),
            reason: 'Conflicts with calendar event',
          });
          continue;
        }
      } catch (err) {
        console.warn('Calendar check failed for slot:', err);
        // Continue without calendar check
      }
    }

    // Create Google Calendar event
    let googleEventId: string | null = null;
    let googleMeetLink: string | null = null;

    const calendarAccessToken = hostAdmin?.google_access_token || session.google_access_token;
    const calendarRefreshToken = hostAdmin?.google_refresh_token || session.google_refresh_token;
    const hostEmail = hostAdmin?.email || event.host_email;

    // For collective events and webinars with co-hosts, get all co-host emails
    let coHostEmails: string[] = [];
    if (event.meeting_type === 'collective' || event.meeting_type === 'webinar') {
      const participatingHosts = await getParticipatingHosts(event_id);
      if (participatingHosts.length > 0) {
        const { data: coHosts } = await supabase
          .from('oh_admins')
          .select('email')
          .in('id', participatingHosts);
        coHostEmails = coHosts?.map(h => h.email) || [];
      }
    }

    if (calendarAccessToken && calendarRefreshToken) {
      try {
        const calendarResult = await createCalendarEvent(
          calendarAccessToken,
          calendarRefreshToken,
          {
            summary: event.name,
            description: event.description || '',
            startTime: targetStartTime.toISOString(),
            endTime: targetEndTime.toISOString(),
            hostEmail: hostEmail,
            coHostEmails: coHostEmails.length > 0 ? coHostEmails : undefined,
          }
        );
        googleEventId = calendarResult.eventId || null;
        googleMeetLink = calendarResult.meetLink;
      } catch (err) {
        console.error('Failed to create calendar event:', err);
        // Continue without calendar integration
      }
    }

    // Create the slot
    const { data: newSlot, error: createError } = await supabase
      .from('oh_slots')
      .insert({
        event_id,
        start_time: targetStartTime.toISOString(),
        end_time: targetEndTime.toISOString(),
        assigned_host_id: sourceSlot.assigned_host_id || null,
        google_event_id: googleEventId,
        google_meet_link: googleMeetLink,
      })
      .select()
      .single();

    if (createError) {
      results.skipped.push({
        start_time: targetStartTime.toISOString(),
        reason: createError.message,
      });
    } else {
      results.created.push({
        start_time: newSlot.start_time,
        end_time: newSlot.end_time,
      });
    }
  }

  return NextResponse.json({
    message: `Created ${results.created.length} slot(s), skipped ${results.skipped.length}`,
    ...results,
  });
}
