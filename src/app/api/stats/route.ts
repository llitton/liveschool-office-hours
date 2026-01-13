import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { startOfMonth, endOfMonth, format, addHours } from 'date-fns';

interface ActionItem {
  type: 'no_slots' | 'low_bookings' | 'missing_template' | 'upcoming_soon';
  message: string;
  link: string;
  priority: 'high' | 'medium' | 'low';
}

export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const in24Hours = addHours(now, 24);

  // Get upcoming slots with details for next session and capacity
  const { data: upcomingSlots } = await supabase
    .from('oh_slots')
    .select(`
      id,
      start_time,
      event_id,
      event:oh_events(id, name, max_attendees, confirmation_subject),
      bookings:oh_bookings(count)
    `)
    .eq('is_cancelled', false)
    .gte('start_time', now.toISOString())
    .order('start_time', { ascending: true });

  // Calculate next session and open capacity
  let nextSession = null;
  let openCapacity = 0;
  const actionItems: ActionItem[] = [];

  for (const slot of upcomingSlots || []) {
    const eventData = Array.isArray(slot.event) ? slot.event[0] : slot.event;
    const maxAttendees = eventData?.max_attendees || 30;
    const booked = slot.bookings?.[0]?.count || 0;
    const available = maxAttendees - booked;
    openCapacity += available;

    if (!nextSession) {
      nextSession = {
        id: slot.id,
        start_time: slot.start_time,
        event_id: eventData?.id || slot.event_id,
        event_name: eventData?.name || 'Session',
        booked,
        capacity: maxAttendees,
      };
    }

    // Check for sessions in next 24 hours with low bookings
    if (new Date(slot.start_time) < in24Hours && booked < 3) {
      actionItems.push({
        type: 'low_bookings',
        message: `Session tomorrow has only ${booked} booking${booked !== 1 ? 's' : ''}`,
        link: `/admin/events/${eventData?.id || slot.event_id}`,
        priority: 'medium',
      });
    }
  }

  // Get all events to check for missing slots or templates
  const { data: events } = await supabase
    .from('oh_events')
    .select('id, name, confirmation_subject')
    .eq('is_active', true);

  for (const event of events || []) {
    // Check if event has no upcoming slots
    const hasUpcomingSlots = (upcomingSlots || []).some(
      (s) => {
        const eventData = Array.isArray(s.event) ? s.event[0] : s.event;
        return eventData?.id === event.id;
      }
    );

    if (!hasUpcomingSlots) {
      actionItems.push({
        type: 'no_slots',
        message: `"${event.name}" has no upcoming time slots`,
        link: `/admin/events/${event.id}`,
        priority: 'high',
      });
    }

    // Check for missing email templates
    if (!event.confirmation_subject) {
      actionItems.push({
        type: 'missing_template',
        message: `"${event.name}" is using default email templates`,
        link: `/admin/events/${event.id}/emails`,
        priority: 'low',
      });
    }
  }

  // Get completed sessions this month with attendance data
  const { data: completedSlots } = await supabase
    .from('oh_slots')
    .select(`
      id,
      start_time,
      event:oh_events(max_attendees),
      bookings:oh_bookings(count, attended_at, no_show_at)
    `)
    .eq('is_cancelled', false)
    .gte('start_time', monthStart.toISOString())
    .lt('start_time', now.toISOString());

  // Calculate attendance rate based on marked attendance
  let totalMarked = 0;
  let totalAttended = 0;
  for (const slot of completedSlots || []) {
    const bookingsArray = slot.bookings as Array<{ attended_at: string | null; no_show_at: string | null }> || [];
    for (const booking of bookingsArray) {
      if (booking.attended_at || booking.no_show_at) {
        totalMarked++;
        if (booking.attended_at) {
          totalAttended++;
        }
      }
    }
  }

  const attendanceRate = totalMarked > 0 ? Math.round((totalAttended / totalMarked) * 100) : 0;
  let attendanceContext = '';
  if (totalMarked === 0) {
    attendanceContext = completedSlots && completedSlots.length > 0
      ? 'Mark attendance on past sessions'
      : 'First session upcoming';
  } else {
    attendanceContext = `Based on ${totalMarked} marked attendance${totalMarked !== 1 ? 's' : ''}`;
  }

  // Get most popular time slots (day of week + hour)
  const { data: allSlots } = await supabase
    .from('oh_slots')
    .select(`
      start_time,
      bookings:oh_bookings(count)
    `)
    .eq('is_cancelled', false);

  const timeSlotPopularity: Record<string, { count: number; bookings: number }> = {};
  for (const slot of allSlots || []) {
    const date = new Date(slot.start_time);
    const dayHour = `${format(date, 'EEEE')} at ${format(date, 'h:mm a')}`;
    if (!timeSlotPopularity[dayHour]) {
      timeSlotPopularity[dayHour] = { count: 0, bookings: 0 };
    }
    timeSlotPopularity[dayHour].count++;
    timeSlotPopularity[dayHour].bookings += slot.bookings?.[0]?.count || 0;
  }

  const popularTimeSlots = Object.entries(timeSlotPopularity)
    .map(([time, data]) => ({
      time,
      sessions: data.count,
      totalBookings: data.bookings,
      avgBookings: data.count > 0 ? Math.round(data.bookings / data.count) : 0,
    }))
    .sort((a, b) => b.totalBookings - a.totalBookings)
    .slice(0, 5);

  // Get recent bookings
  const { data: recentBookings } = await supabase
    .from('oh_bookings')
    .select(`
      id,
      first_name,
      last_name,
      email,
      created_at,
      slot:oh_slots(
        start_time,
        event:oh_events(name)
      )
    `)
    .is('cancelled_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    nextSession,
    openCapacity,
    upcomingSessions: upcomingSlots?.length || 0,
    attendanceRate,
    attendanceContext,
    actionItems: actionItems.slice(0, 3), // Limit to 3 action items
    popularTimeSlots,
    recentBookings: recentBookings || [],
  });
}
