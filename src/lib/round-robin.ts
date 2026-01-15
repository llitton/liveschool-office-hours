import { getServiceSupabase } from './supabase';
import { checkTimeAvailability } from './availability';
import type { RoundRobinStrategy, RoundRobinPeriod, OHAdmin } from '@/types';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns';

export interface RoundRobinConfig {
  strategy: RoundRobinStrategy;
  period: RoundRobinPeriod;
  hostIds: string[];
}

export interface HostAssignment {
  hostId: string;
  host: OHAdmin;
  reason: string;
}

/**
 * Get participating hosts for a round-robin event
 * Uses hosts from oh_event_hosts with role 'host' or 'owner'
 */
export async function getParticipatingHosts(eventId: string): Promise<string[]> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_event_hosts')
    .select('admin_id')
    .eq('event_id', eventId)
    .in('role', ['owner', 'host'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to get participating hosts:', error);
    return [];
  }

  return (data || []).map((h) => h.admin_id);
}

/**
 * Get booking counts per host within a period
 */
export async function getHostBookingCounts(
  hostIds: string[],
  period: RoundRobinPeriod,
  referenceDate: Date
): Promise<Record<string, number>> {
  const supabase = getServiceSupabase();

  // Calculate period boundaries
  let periodStart: Date;
  let periodEnd: Date;

  switch (period) {
    case 'day':
      periodStart = startOfDay(referenceDate);
      periodEnd = endOfDay(referenceDate);
      break;
    case 'week':
      periodStart = startOfWeek(referenceDate, { weekStartsOn: 0 });
      periodEnd = endOfWeek(referenceDate, { weekStartsOn: 0 });
      break;
    case 'month':
      periodStart = startOfMonth(referenceDate);
      periodEnd = endOfMonth(referenceDate);
      break;
    case 'all_time':
    default:
      // For all_time, we don't filter by date
      periodStart = new Date(0);
      periodEnd = new Date('2100-01-01');
      break;
  }

  const counts: Record<string, number> = {};

  // Initialize all hosts with 0
  for (const hostId of hostIds) {
    counts[hostId] = 0;
  }

  // Query bookings with assigned_host_id in the period
  const { data, error } = await supabase
    .from('oh_bookings')
    .select('assigned_host_id, slot:oh_slots!inner(start_time)')
    .in('assigned_host_id', hostIds)
    .is('cancelled_at', null)
    .gte('slot.start_time', periodStart.toISOString())
    .lte('slot.start_time', periodEnd.toISOString());

  if (error) {
    console.error('Failed to get booking counts:', error);
    return counts;
  }

  // Count bookings per host
  for (const booking of data || []) {
    if (booking.assigned_host_id) {
      counts[booking.assigned_host_id] = (counts[booking.assigned_host_id] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Check if a host is within their meeting limits for the day/week
 */
export async function checkHostMeetingLimits(
  hostId: string,
  slotDate: Date
): Promise<{ withinLimits: boolean; dailyCount: number; weeklyCount: number }> {
  const supabase = getServiceSupabase();

  // Get the admin's limits
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('max_meetings_per_day, max_meetings_per_week')
    .eq('id', hostId)
    .single();

  if (!admin) {
    return { withinLimits: false, dailyCount: 0, weeklyCount: 0 };
  }

  const maxDaily = admin.max_meetings_per_day || 8;
  const maxWeekly = admin.max_meetings_per_week || 30;

  // Count daily bookings (where this host is assigned)
  const dayStart = startOfDay(slotDate);
  const dayEnd = endOfDay(slotDate);

  const { count: dailyCount } = await supabase
    .from('oh_bookings')
    .select('id, slot:oh_slots!inner(start_time)', { count: 'exact', head: true })
    .eq('assigned_host_id', hostId)
    .is('cancelled_at', null)
    .gte('slot.start_time', dayStart.toISOString())
    .lte('slot.start_time', dayEnd.toISOString());

  // Count weekly bookings
  const weekStart = startOfWeek(slotDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(slotDate, { weekStartsOn: 0 });

  const { count: weeklyCount } = await supabase
    .from('oh_bookings')
    .select('id, slot:oh_slots!inner(start_time)', { count: 'exact', head: true })
    .eq('assigned_host_id', hostId)
    .is('cancelled_at', null)
    .gte('slot.start_time', weekStart.toISOString())
    .lte('slot.start_time', weekEnd.toISOString());

  const actualDaily = dailyCount || 0;
  const actualWeekly = weeklyCount || 0;

  return {
    withinLimits: actualDaily < maxDaily && actualWeekly < maxWeekly,
    dailyCount: actualDaily,
    weeklyCount: actualWeekly,
  };
}

/**
 * Get admin details by ID
 */
async function getAdminById(adminId: string): Promise<OHAdmin | null> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('id', adminId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Get or create round-robin state for an event
 */
async function getRoundRobinState(eventId: string): Promise<{
  last_assigned_host_id: string | null;
  assignment_count: number;
} | null> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_round_robin_state')
    .select('last_assigned_host_id, assignment_count')
    .eq('event_id', eventId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get round-robin state:', error);
  }

  return data;
}

/**
 * Update round-robin state after assignment
 */
async function updateRoundRobinState(
  eventId: string,
  assignedHostId: string
): Promise<void> {
  const supabase = getServiceSupabase();

  const { data: existing } = await supabase
    .from('oh_round_robin_state')
    .select('id, assignment_count')
    .eq('event_id', eventId)
    .single();

  if (existing) {
    await supabase
      .from('oh_round_robin_state')
      .update({
        last_assigned_host_id: assignedHostId,
        last_assigned_at: new Date().toISOString(),
        assignment_count: (existing.assignment_count || 0) + 1,
      })
      .eq('event_id', eventId);
  } else {
    await supabase.from('oh_round_robin_state').insert({
      event_id: eventId,
      last_assigned_host_id: assignedHostId,
      last_assigned_at: new Date().toISOString(),
      assignment_count: 1,
    });
  }
}

/**
 * Select next host using cycle strategy (simple rotation)
 */
async function selectCycleHost(
  eventId: string,
  hostIds: string[],
  slotStart: Date,
  slotEnd: Date
): Promise<{ hostId: string; reason: string } | null> {
  const state = await getRoundRobinState(eventId);

  // Find starting position in the rotation
  let startIndex = 0;
  if (state?.last_assigned_host_id) {
    const lastIndex = hostIds.indexOf(state.last_assigned_host_id);
    if (lastIndex >= 0) {
      startIndex = (lastIndex + 1) % hostIds.length;
    }
  }

  // Try each host starting from the next in rotation
  for (let i = 0; i < hostIds.length; i++) {
    const index = (startIndex + i) % hostIds.length;
    const hostId = hostIds[index];

    // Check availability
    const availability = await checkTimeAvailability(hostId, slotStart, slotEnd);
    if (!availability.available) {
      continue;
    }

    // Check meeting limits
    const limits = await checkHostMeetingLimits(hostId, slotStart);
    if (!limits.withinLimits) {
      continue;
    }

    // This host is available and within limits
    await updateRoundRobinState(eventId, hostId);
    return {
      hostId,
      reason: `cycle (position ${index + 1} of ${hostIds.length})`,
    };
  }

  return null; // No available host
}

/**
 * Select next host using least_bookings strategy (load balancing)
 */
async function selectLeastBookingsHost(
  eventId: string,
  hostIds: string[],
  period: RoundRobinPeriod,
  slotStart: Date,
  slotEnd: Date
): Promise<{ hostId: string; reason: string } | null> {
  // Get booking counts for all hosts
  const counts = await getHostBookingCounts(hostIds, period, slotStart);

  // Create candidates with availability check
  const candidates: { hostId: string; count: number }[] = [];

  for (const hostId of hostIds) {
    // Check availability
    const availability = await checkTimeAvailability(hostId, slotStart, slotEnd);
    if (!availability.available) {
      continue;
    }

    // Check meeting limits
    const limits = await checkHostMeetingLimits(hostId, slotStart);
    if (!limits.withinLimits) {
      continue;
    }

    candidates.push({
      hostId,
      count: counts[hostId] || 0,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by booking count (ascending) and pick the one with fewest
  candidates.sort((a, b) => a.count - b.count);
  const selected = candidates[0];

  await updateRoundRobinState(eventId, selected.hostId);
  return {
    hostId: selected.hostId,
    reason: `least_bookings (${selected.count} bookings in ${period})`,
  };
}

/**
 * Get total available hours per host for a given period
 * Calculates from availability patterns
 */
async function getHostAvailableHours(
  hostIds: string[],
  period: RoundRobinPeriod,
  referenceDate: Date
): Promise<Record<string, number>> {
  const supabase = getServiceSupabase();
  const hours: Record<string, number> = {};

  // Initialize all hosts with 0
  for (const hostId of hostIds) {
    hours[hostId] = 0;
  }

  // Get availability patterns for all hosts
  const { data: patterns } = await supabase
    .from('oh_availability_patterns')
    .select('admin_id, day_of_week, start_time, end_time')
    .in('admin_id', hostIds)
    .eq('is_active', true);

  if (!patterns) return hours;

  // Calculate hours based on period
  // For weekly periods, sum up all pattern hours
  // For other periods, adjust accordingly
  for (const pattern of patterns) {
    const startParts = pattern.start_time.split(':').map(Number);
    const endParts = pattern.end_time.split(':').map(Number);
    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];
    const patternHours = (endMinutes - startMinutes) / 60;

    // Count how many times this day appears in the period
    let multiplier = 1;
    switch (period) {
      case 'week':
        multiplier = 1; // Each day of week appears once per week
        break;
      case 'month':
        multiplier = 4; // Approximately 4 weeks per month
        break;
      case 'all_time':
        multiplier = 52; // Approximately 52 weeks per year
        break;
      case 'day':
      default:
        // For daily, only count if the pattern matches today
        const today = referenceDate.getDay();
        multiplier = pattern.day_of_week === today ? 1 : 0;
        break;
    }

    hours[pattern.admin_id] = (hours[pattern.admin_id] || 0) + (patternHours * multiplier);
  }

  return hours;
}

/**
 * Select next host using availability_weighted strategy
 * This balances bookings relative to each host's available hours
 * Hosts with more available hours get proportionally more bookings
 */
async function selectAvailabilityWeightedHost(
  eventId: string,
  hostIds: string[],
  period: RoundRobinPeriod,
  slotStart: Date,
  slotEnd: Date
): Promise<{ hostId: string; reason: string } | null> {
  // Get booking counts and available hours for all hosts
  const [counts, availableHours] = await Promise.all([
    getHostBookingCounts(hostIds, period, slotStart),
    getHostAvailableHours(hostIds, period, slotStart),
  ]);

  // Create candidates with availability check and utilization calculation
  const candidates: {
    hostId: string;
    count: number;
    availableHours: number;
    utilization: number;
  }[] = [];

  for (const hostId of hostIds) {
    // Check availability for this specific slot
    const availability = await checkTimeAvailability(hostId, slotStart, slotEnd);
    if (!availability.available) {
      continue;
    }

    // Check meeting limits
    const limits = await checkHostMeetingLimits(hostId, slotStart);
    if (!limits.withinLimits) {
      continue;
    }

    const hostHours = availableHours[hostId] || 0;
    const hostCount = counts[hostId] || 0;

    // Calculate utilization rate (bookings per available hour)
    // If no availability patterns set, fall back to raw count
    const utilization = hostHours > 0 ? hostCount / hostHours : hostCount;

    candidates.push({
      hostId,
      count: hostCount,
      availableHours: hostHours,
      utilization,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by utilization (ascending) - select host with lowest utilization
  candidates.sort((a, b) => a.utilization - b.utilization);
  const selected = candidates[0];

  await updateRoundRobinState(eventId, selected.hostId);

  const utilizationPct = selected.availableHours > 0
    ? Math.round(selected.utilization * 100)
    : selected.count;

  return {
    hostId: selected.hostId,
    reason: `availability_weighted (${selected.count} bookings, ${selected.availableHours.toFixed(1)}h available, ${utilizationPct}% utilized)`,
  };
}

/**
 * Main function: Select the next host for a round-robin booking
 */
export async function selectNextHost(
  eventId: string,
  slotStart: Date,
  slotEnd: Date,
  config: RoundRobinConfig
): Promise<HostAssignment | null> {
  const { strategy, period, hostIds } = config;

  if (hostIds.length === 0) {
    console.error('No hosts configured for round-robin');
    return null;
  }

  let result: { hostId: string; reason: string } | null = null;

  switch (strategy) {
    case 'cycle':
      result = await selectCycleHost(eventId, hostIds, slotStart, slotEnd);
      break;

    case 'least_bookings':
      result = await selectLeastBookingsHost(
        eventId,
        hostIds,
        period,
        slotStart,
        slotEnd
      );
      break;

    case 'availability_weighted':
      result = await selectAvailabilityWeightedHost(
        eventId,
        hostIds,
        period,
        slotStart,
        slotEnd
      );
      break;

    default:
      console.error('Unknown round-robin strategy:', strategy);
      return null;
  }

  if (!result) {
    return null;
  }

  // Get full admin details
  const host = await getAdminById(result.hostId);
  if (!host) {
    console.error('Could not find host:', result.hostId);
    return null;
  }

  return {
    hostId: result.hostId,
    host,
    reason: result.reason,
  };
}

/**
 * Get round-robin distribution stats for an event
 */
export async function getRoundRobinStats(eventId: string): Promise<{
  totalAssignments: number;
  hostStats: Array<{
    hostId: string;
    hostName: string;
    bookingCount: number;
    percentage: number;
  }>;
}> {
  const supabase = getServiceSupabase();

  // Get all hosts for this event
  const hostIds = await getParticipatingHosts(eventId);

  // Get booking counts
  const counts = await getHostBookingCounts(hostIds, 'all_time', new Date());

  // Get host names
  const { data: admins } = await supabase
    .from('oh_admins')
    .select('id, name, email')
    .in('id', hostIds);

  const adminMap = new Map(
    (admins || []).map((a) => [a.id, a.name || a.email])
  );

  // Calculate total
  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

  // Build stats
  const hostStats = hostIds.map((hostId) => ({
    hostId,
    hostName: adminMap.get(hostId) || 'Unknown',
    bookingCount: counts[hostId] || 0,
    percentage: total > 0 ? Math.round(((counts[hostId] || 0) / total) * 100) : 0,
  }));

  return {
    totalAssignments: total,
    hostStats,
  };
}
