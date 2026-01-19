import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth, getHostWithTokens } from '@/lib/auth';
import { createCalendarEvent, getFreeBusy } from '@/lib/google';
import { parseISO, addMinutes, startOfDay, endOfDay, areIntervalsOverlapping, isValid, parse } from 'date-fns';

interface SlotRow {
  date: string;
  time: string;
}

// POST - Import slots from CSV
export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const eventId = formData.get('event_id') as string | null;

  if (!file || !eventId) {
    return NextResponse.json(
      { error: 'file and event_id are required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get the event details
  const { data: event, error: eventError } = await supabase
    .from('oh_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Parse CSV file
  const text = await file.text();
  const lines = text.trim().split('\n');

  // Detect if first line is a header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('date') || firstLine.includes('time');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows: SlotRow[] = [];
  const parseErrors: string[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;

    // Support both comma and tab delimiters
    const parts = line.includes('\t') ? line.split('\t') : line.split(',');

    if (parts.length < 2) {
      parseErrors.push(`Line ${i + 1 + (hasHeader ? 1 : 0)}: Invalid format, expected date,time`);
      continue;
    }

    const dateStr = parts[0].trim();
    const timeStr = parts[1].trim();

    // Validate date format (YYYY-MM-DD)
    const dateMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
    if (!dateMatch) {
      parseErrors.push(`Line ${i + 1 + (hasHeader ? 1 : 0)}: Invalid date format "${dateStr}", expected YYYY-MM-DD`);
      continue;
    }

    // Validate time format (HH:MM or H:MM)
    const timeMatch = timeStr.match(/^\d{1,2}:\d{2}$/);
    if (!timeMatch) {
      parseErrors.push(`Line ${i + 1 + (hasHeader ? 1 : 0)}: Invalid time format "${timeStr}", expected HH:MM`);
      continue;
    }

    // Verify the date/time combination is valid
    const testDate = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());
    if (!isValid(testDate)) {
      parseErrors.push(`Line ${i + 1 + (hasHeader ? 1 : 0)}: Invalid date/time "${dateStr} ${timeStr}"`);
      continue;
    }

    rows.push({ date: dateStr, time: timeStr });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      {
        error: 'No valid rows found in CSV',
        parseErrors: parseErrors.slice(0, 10), // Limit errors shown
      },
      { status: 400 }
    );
  }

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

  // Get all existing slots for the event to check conflicts
  const { data: existingSlots } = await supabase
    .from('oh_slots')
    .select('id, start_time, end_time')
    .eq('event_id', eventId)
    .eq('is_cancelled', false);

  const results = {
    created: [] as Array<{ date: string; time: string }>,
    skipped: [] as Array<{ date: string; time: string; reason: string }>,
    parseErrors,
  };

  // Process each row
  for (const row of rows) {
    const startTime = parse(`${row.date} ${row.time}`, 'yyyy-MM-dd HH:mm', new Date());
    const endTime = addMinutes(startTime, event.duration_minutes);

    // Skip if time is in the past
    if (startTime < new Date()) {
      results.skipped.push({
        ...row,
        reason: 'Time is in the past',
      });
      continue;
    }

    // Check for conflicts with existing slots
    let hasConflict = false;
    for (const existing of existingSlots || []) {
      const existingStart = parseISO(existing.start_time);
      const existingEnd = parseISO(existing.end_time);

      if (
        areIntervalsOverlapping(
          { start: startTime, end: endTime },
          { start: existingStart, end: existingEnd }
        )
      ) {
        hasConflict = true;
        break;
      }
    }

    if (hasConflict) {
      results.skipped.push({
        ...row,
        reason: 'Conflicts with existing slot',
      });
      continue;
    }

    // Check for conflicts with other rows being imported (duplicates)
    const alreadyCreated = results.created.find(
      (c) => c.date === row.date && c.time === row.time
    );
    if (alreadyCreated) {
      results.skipped.push({
        ...row,
        reason: 'Duplicate entry in import',
      });
      continue;
    }

    // Check calendar availability if we have tokens
    if (hostAdmin?.google_access_token && hostAdmin?.google_refresh_token) {
      try {
        const dayStart = startOfDay(startTime);
        const dayEnd = endOfDay(startTime);

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
              { start: startTime, end: endTime },
              { start: busyStart, end: busyEnd }
            )
          ) {
            calendarConflict = true;
            break;
          }
        }

        if (calendarConflict) {
          results.skipped.push({
            ...row,
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

    if (calendarAccessToken && calendarRefreshToken) {
      try {
        const calendarResult = await createCalendarEvent(
          calendarAccessToken,
          calendarRefreshToken,
          {
            summary: `[Connect] ${event.name}`,
            description: event.description || '',
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            hostEmail: hostEmail,
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
        event_id: eventId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        google_event_id: googleEventId,
        google_meet_link: googleMeetLink,
      })
      .select()
      .single();

    if (createError) {
      results.skipped.push({
        ...row,
        reason: createError.message,
      });
    } else {
      results.created.push(row);

      // Add to existing slots to prevent duplicates within the same import
      existingSlots?.push({
        id: newSlot.id,
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
