import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

interface AvailabilityPattern {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
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

  const { data: admins, error } = await supabase
    .from('oh_admins')
    .select('id, name, email')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If availability requested, fetch patterns for all admins
  if (includeAvailability && admins && admins.length > 0) {
    const adminIds = admins.map((a) => a.id);

    const { data: patterns } = await supabase
      .from('oh_availability_patterns')
      .select('*')
      .in('admin_id', adminIds)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true });

    // Group patterns by admin_id
    const patternsByAdmin: Record<string, AvailabilityPattern[]> = {};
    (patterns || []).forEach((p: AvailabilityPattern & { admin_id: string }) => {
      if (!patternsByAdmin[p.admin_id]) {
        patternsByAdmin[p.admin_id] = [];
      }
      patternsByAdmin[p.admin_id].push(p);
    });

    // Add availability summary to each admin
    const adminsWithAvailability = admins.map((admin) => {
      const adminPatterns = patternsByAdmin[admin.id] || [];
      return {
        ...admin,
        availability_patterns: adminPatterns,
        availability_summary: formatAvailabilitySummary(adminPatterns),
      };
    });

    return NextResponse.json(adminsWithAvailability);
  }

  return NextResponse.json(admins || []);
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
