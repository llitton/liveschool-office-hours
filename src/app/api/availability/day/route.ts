import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth, getSession } from '@/lib/auth';
import { getFreeBusy } from '@/lib/google';
import { startOfDay, endOfDay, parseISO, format } from 'date-fns';

interface TimeBlock {
  start: string; // HH:mm format
  end: string;
  type: 'busy' | 'slot' | 'available';
  title?: string;
}

// GET busy times and existing slots for a specific day
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await getSession();
    if (!session) throw new Error('Not authenticated');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  const eventId = searchParams.get('eventId');

  if (!dateStr) {
    return NextResponse.json({ error: 'date parameter is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const date = parseISO(dateStr);
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const blocks: TimeBlock[] = [];

  // Get admin's Google tokens
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('google_access_token, google_refresh_token')
    .eq('id', session.id)
    .single();

  // Fetch Google Calendar busy times
  if (admin?.google_access_token && admin?.google_refresh_token) {
    try {
      const busyTimes = await getFreeBusy(
        admin.google_access_token,
        admin.google_refresh_token,
        dayStart.toISOString(),
        dayEnd.toISOString()
      );

      busyTimes.forEach((busy) => {
        const startTime = new Date(busy.start);
        const endTime = new Date(busy.end);

        // Only include if it's on the requested day
        if (startTime >= dayStart && startTime < dayEnd) {
          blocks.push({
            start: format(startTime, 'HH:mm'),
            end: format(endTime, 'HH:mm'),
            type: 'busy',
            title: 'Calendar event',
          });
        }
      });
    } catch (err) {
      console.error('Failed to fetch Google Calendar:', err);
    }
  }

  // Fetch existing OH slots for this day (optionally filtered by event)
  let slotsQuery = supabase
    .from('oh_slots')
    .select('start_time, end_time, event:oh_events(name)')
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())
    .eq('is_cancelled', false);

  if (eventId) {
    // If filtering by event, exclude that event's slots (we want to see OTHER conflicts)
    slotsQuery = slotsQuery.neq('event_id', eventId);
  }

  const { data: existingSlots } = await slotsQuery;

  if (existingSlots) {
    existingSlots.forEach((slot) => {
      const startTime = new Date(slot.start_time);
      const endTime = new Date(slot.end_time);
      const eventName = slot.event && typeof slot.event === 'object' && 'name' in slot.event
        ? (slot.event as { name: string }).name
        : 'Office Hours';

      blocks.push({
        start: format(startTime, 'HH:mm'),
        end: format(endTime, 'HH:mm'),
        type: 'slot',
        title: eventName,
      });
    });
  }

  // Get availability patterns for this day of week
  const dayOfWeek = date.getDay();
  const { data: patterns } = await supabase
    .from('oh_availability_patterns')
    .select('start_time, end_time')
    .eq('admin_id', session.id)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true);

  // Build available windows based on patterns (if set)
  const availableWindows: { start: string; end: string }[] = [];
  if (patterns && patterns.length > 0) {
    patterns.forEach((pattern) => {
      availableWindows.push({
        start: pattern.start_time.slice(0, 5), // Convert HH:mm:ss to HH:mm
        end: pattern.end_time.slice(0, 5),
      });
    });
  }

  // Sort blocks by start time
  blocks.sort((a, b) => a.start.localeCompare(b.start));

  return NextResponse.json({
    date: dateStr,
    dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
    blocks,
    availableWindows,
    hasAvailabilityPatterns: patterns && patterns.length > 0,
  });
}
