import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { getAvailableSlots, syncGoogleCalendarBusy } from '@/lib/availability';
import { addDays, format, parseISO, isToday, isTomorrow } from 'date-fns';

interface AvailabilityPattern {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
}

interface AdminWithTokens {
  id: string;
  name: string | null;
  email: string;
  google_access_token?: string | null;
  google_refresh_token?: string | null;
}

// GET all admins (team members) with optional availability
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeAvailability = searchParams.get('includeAvailability') === 'true';

  const supabase = getServiceSupabase();

  // If we need calendar data, fetch tokens too
  const selectFields = includeAvailability
    ? 'id, name, email, google_access_token, google_refresh_token'
    : 'id, name, email';

  const { data: admins, error } = await supabase
    .from('oh_admins')
    .select(selectFields)
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If availability requested, compute real availability from calendar
  if (includeAvailability && admins && admins.length > 0) {
    const now = new Date();
    const lookAheadDays = 14; // Look 2 weeks ahead
    const endDate = addDays(now, lookAheadDays);

    const adminsWithAvailability = await Promise.all(
      (admins as unknown as AdminWithTokens[]).map(async (admin) => {
        const hasGoogleConnected = !!(admin.google_access_token && admin.google_refresh_token);

        // Base response without tokens
        const baseAdmin = {
          id: admin.id,
          name: admin.name,
          email: admin.email,
        };

        if (!hasGoogleConnected) {
          return {
            ...baseAdmin,
            google_connected: false,
            availability_summary: 'Google Calendar not connected',
            next_available_slots: [],
          };
        }

        try {
          // Sync calendar busy data (in background, don't block)
          syncGoogleCalendarBusy(
            admin.id,
            admin.google_access_token!,
            admin.google_refresh_token!,
            now,
            endDate
          ).catch((err) => console.error(`Failed to sync calendar for ${admin.email}:`, err));

          // Get available slots (30-min duration, 15-min buffer as defaults)
          const availableSlots = await getAvailableSlots(
            admin.id,
            30, // default duration
            15, // default buffer
            now,
            endDate
          );

          // Format next available slots (show up to 5)
          const nextSlots = availableSlots.slice(0, 5).map((slot) => ({
            start: slot.start.toISOString(),
            display: formatSlotDisplay(slot.start),
          }));

          return {
            ...baseAdmin,
            google_connected: true,
            availability_summary: formatNextAvailableSummary(availableSlots),
            next_available_slots: nextSlots,
          };
        } catch (err) {
          console.error(`Failed to get availability for ${admin.email}:`, err);
          return {
            ...baseAdmin,
            google_connected: true,
            availability_summary: 'Unable to load calendar',
            next_available_slots: [],
          };
        }
      })
    );

    return NextResponse.json(adminsWithAvailability);
  }

  return NextResponse.json(admins || []);
}

// Format a single slot for display (e.g., "Today 2pm", "Tomorrow 10am", "Mon 3pm")
function formatSlotDisplay(date: Date): string {
  const time = format(date, 'ha').toLowerCase(); // "2pm"

  if (isToday(date)) {
    return `Today ${time}`;
  }
  if (isTomorrow(date)) {
    return `Tomorrow ${time}`;
  }

  // Within this week, show day name
  const dayName = format(date, 'EEE'); // "Mon"
  return `${dayName} ${time}`;
}

// Format summary of next available times
function formatNextAvailableSummary(slots: { start: Date; end: Date }[]): string {
  if (slots.length === 0) {
    return 'No availability in next 2 weeks';
  }

  // Show first 3 available times
  const summarySlots = slots.slice(0, 3);
  const summaryText = summarySlots.map((s) => formatSlotDisplay(s.start)).join(', ');

  if (slots.length > 3) {
    return `Next: ${summaryText} +${slots.length - 3} more`;
  }

  return `Next: ${summaryText}`;
}

// Format availability patterns into a human-readable summary
function formatAvailabilitySummary(patterns: AvailabilityPattern[]): string {
  if (patterns.length === 0) {
    return 'No availability set';
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group by time slot to find consecutive days
  const timeSlots: Record<string, number[]> = {};
  patterns.forEach((p) => {
    const timeKey = `${formatTime(p.start_time)}-${formatTime(p.end_time)}`;
    if (!timeSlots[timeKey]) {
      timeSlots[timeKey] = [];
    }
    timeSlots[timeKey].push(p.day_of_week);
  });

  // Format each time slot
  const summaryParts: string[] = [];
  Object.entries(timeSlots).forEach(([timeKey, days]) => {
    days.sort((a, b) => a - b);
    const dayStr = formatDayRange(days, dayNames);
    summaryParts.push(`${dayStr} ${timeKey}`);
  });

  return summaryParts.join(', ');
}

function formatTime(time: string): string {
  // Convert "HH:mm:ss" or "HH:mm" to "Ha" format (e.g., "9am", "2pm")
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHour = hours % 12 || 12;
  if (minutes === 0) {
    return `${displayHour}${period}`;
  }
  return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
}

function formatDayRange(days: number[], dayNames: string[]): string {
  if (days.length === 1) {
    return dayNames[days[0]];
  }

  // Check if days are consecutive
  let isConsecutive = true;
  for (let i = 1; i < days.length; i++) {
    if (days[i] !== days[i - 1] + 1) {
      isConsecutive = false;
      break;
    }
  }

  // Check for Mon-Fri pattern
  if (days.length === 5 && days[0] === 1 && days[4] === 5) {
    return 'Mon-Fri';
  }

  if (isConsecutive && days.length > 2) {
    return `${dayNames[days[0]]}-${dayNames[days[days.length - 1]]}`;
  }

  return days.map((d) => dayNames[d]).join(', ');
}
