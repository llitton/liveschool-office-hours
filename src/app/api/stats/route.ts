import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { startOfMonth, endOfMonth, format, addHours, subDays } from 'date-fns';

interface ActionItem {
  type: 'no_slots' | 'low_bookings' | 'missing_template' | 'upcoming_soon' | 'no_availability' | 'no_calendar';
  title: string;
  impact: string;
  cta: string;
  link: string;
  priority: 'high' | 'medium' | 'low';
}

interface SetupItem {
  id: string;
  label: string;
  completed: boolean;
  link: string;
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

  // Scope all queries to events this user hosts or co-hosts
  const { data: adminRecord } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  const adminId = adminRecord?.id;

  const { data: ownedEvents } = await supabase
    .from('oh_events')
    .select('id')
    .eq('host_id', adminId || '');

  const { data: coHostedEvents } = await supabase
    .from('oh_event_hosts')
    .select('event_id')
    .eq('admin_id', adminId || '');

  const hostedEventIds = [
    ...(ownedEvents || []).map(e => e.id),
    ...(coHostedEvents || []).map(e => e.event_id),
  ].filter((v, i, a) => a.indexOf(v) === i);

  if (hostedEventIds.length === 0) {
    return NextResponse.json({
      nextSession: null,
      openCapacity: 0,
      upcomingSessions: 0,
      attendanceRate: 0,
      attendanceContext: 'No events yet',
      actionItems: [],
      setupItems: [],
      setupComplete: 0,
      setupTotal: 0,
      popularTimeSlots: [],
      recentBookings: [],
    });
  }

  // Get upcoming slots with details for next session and capacity
  const { data: upcomingSlots } = await supabase
    .from('oh_slots')
    .select(`
      id,
      start_time,
      event_id,
      event:oh_events!event_id(id, name, max_attendees, confirmation_subject),
      bookings:oh_bookings!slot_id(count)
    `)
    .eq('is_cancelled', false)
    .in('event_id', hostedEventIds)
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
        title: `Session tomorrow has only ${booked} booking${booked !== 1 ? 's' : ''}`,
        impact: 'Consider promoting this session or reaching out to potential attendees.',
        cta: 'View session',
        link: `/admin/events/${eventData?.id || slot.event_id}`,
        priority: 'medium',
      });
    }
  }

  // Get all events to check for missing slots or templates (scoped to user's events)
  const { data: events } = await supabase
    .from('oh_events')
    .select('id, name, confirmation_subject, meeting_type')
    .eq('is_active', true)
    .in('id', hostedEventIds);

  for (const event of events || []) {
    // Check if event has no upcoming slots
    const hasUpcomingSlots = (upcomingSlots || []).some(
      (s) => {
        const eventData = Array.isArray(s.event) ? s.event[0] : s.event;
        return eventData?.id === event.id;
      }
    );

    // Only show "no slots" warning for webinar events
    // Dynamic availability events (one_on_one, round_robin) create slots when booked
    const needsManualSlots = event.meeting_type === 'webinar';
    if (!hasUpcomingSlots && needsManualSlots) {
      actionItems.push({
        type: 'no_slots',
        title: `"${event.name}" has no upcoming time slots`,
        impact: 'Attendees cannot book this event until you add available times.',
        cta: 'Add time slots',
        link: `/admin/events/${event.id}`,
        priority: 'high',
      });
    }

    // Check for missing email templates
    if (!event.confirmation_subject) {
      actionItems.push({
        type: 'missing_template',
        title: `"${event.name}" is using default email templates`,
        impact: 'Personalized emails improve attendance rates and reduce no-shows.',
        cta: 'Customize emails',
        link: `/admin/events/${event.id}/emails`,
        priority: 'low',
      });
    }
  }

  // Get completed sessions this month with attendance data (scoped)
  const { data: completedSlots } = await supabase
    .from('oh_slots')
    .select(`
      id,
      start_time,
      event:oh_events!event_id(max_attendees),
      bookings:oh_bookings!slot_id(count, attended_at, no_show_at)
    `)
    .eq('is_cancelled', false)
    .in('event_id', hostedEventIds)
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
  // Only look at last 90 days for relevance, limit to 500 slots max
  const ninetyDaysAgo = subDays(now, 90);
  const { data: allSlots } = await supabase
    .from('oh_slots')
    .select(`
      start_time,
      bookings:oh_bookings!slot_id(count)
    `)
    .eq('is_cancelled', false)
    .in('event_id', hostedEventIds)
    .gte('start_time', ninetyDaysAgo.toISOString())
    .limit(500);

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

  // Get recent bookings (scoped via slots in user's events)
  const { data: scopedSlots } = await supabase
    .from('oh_slots')
    .select('id')
    .in('event_id', hostedEventIds);

  const scopedSlotIds = (scopedSlots || []).map(s => s.id);

  const { data: recentBookings } = scopedSlotIds.length > 0
    ? await supabase
        .from('oh_bookings')
        .select(`
          id,
          first_name,
          last_name,
          email,
          created_at,
          slot:oh_slots!slot_id(
            start_time,
            event:oh_events!event_id(name)
          )
        `)
        .is('cancelled_at', null)
        .in('slot_id', scopedSlotIds)
        .order('created_at', { ascending: false })
        .limit(5)
    : { data: [] };

  // Get admin info for setup checklist (only boolean checks, not raw tokens)
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id, profile_image')
    .eq('id', adminId || '')
    .single();

  // Check Google connection separately without exposing tokens
  const { count: googleTokenCount } = await supabase
    .from('oh_admins')
    .select('id', { count: 'exact', head: true })
    .eq('email', session.email)
    .not('google_access_token', 'is', null)
    .not('google_refresh_token', 'is', null);

  // Check for availability patterns and timezone for current user
  const { data: patterns } = await supabase
    .from('oh_availability_patterns')
    .select('id, timezone')
    .eq('admin_id', admin?.id || '')
    .eq('is_active', true);

  // Check if user has set their timezone (not null/empty)
  const hasTimezoneSet = patterns?.some(p => p.timezone && p.timezone.length > 0) || false;
  const hasGoogleConnected = (googleTokenCount || 0) > 0;
  const hasProfilePhoto = !!admin?.profile_image;

  // Settings is complete if Google connected AND timezone set (photo is optional but nice)
  const settingsComplete = hasGoogleConnected && hasTimezoneSet;

  // Check for custom questions on any event
  const { data: eventsWithQuestions } = await supabase
    .from('oh_events')
    .select('custom_questions')
    .not('custom_questions', 'is', null);

  const hasCustomQuestions = eventsWithQuestions?.some(
    e => e.custom_questions && Array.isArray(e.custom_questions) && e.custom_questions.length > 0
  );

  // Check if user has webinar events that need manual slots
  const webinarEvents = events?.filter(e => e.meeting_type === 'webinar') || [];
  const hasWebinarEvents = webinarEvents.length > 0;
  const webinarHasSlots = hasWebinarEvents && (upcomingSlots || []).some(s => {
    const eventData = Array.isArray(s.event) ? s.event[0] : s.event;
    return webinarEvents.some(we => we.id === eventData?.id);
  });
  // Slots setup is complete if: no webinar events, OR webinar events have slots, OR there are any slots
  const slotsComplete = !hasWebinarEvents || webinarHasSlots || (upcomingSlots?.length || 0) > 0;

  // Build setup checklist (consolidated)
  const setupItems: SetupItem[] = [
    {
      id: 'settings',
      label: 'Update your settings',
      completed: settingsComplete,
      link: '/admin/settings',
    },
    {
      id: 'event',
      label: 'Create your first event',
      completed: (events?.length || 0) > 0,
      link: '/admin/events/new',
    },
    // Only show "Add time slots" step if user has webinar events that need slots
    ...(hasWebinarEvents ? [{
      id: 'slots',
      label: 'Add time slots to an event',
      completed: slotsComplete,
      link: webinarEvents[0] ? `/admin/events/${webinarEvents[0].id}` : '/admin/events/new',
    }] : []),
    {
      id: 'questions',
      label: 'Add booking questions',
      completed: hasCustomQuestions || false,
      link: events?.[0] ? `/admin/events/${events[0].id}/settings` : '/admin/events/new',
    },
  ];

  // Add action items for setup if incomplete
  if (!hasGoogleConnected) {
    actionItems.push({
      type: 'no_calendar',
      title: 'Google Calendar not connected',
      impact: 'Sessions won\'t sync to your calendar and attendees won\'t get Google Meet links.',
      cta: 'Connect calendar',
      link: '/api/auth/login',
      priority: 'high',
    });
  }

  if ((patterns?.length || 0) === 0 && (events?.length || 0) > 0) {
    actionItems.push({
      type: 'no_availability',
      title: 'No availability patterns set',
      impact: 'Setting your preferred hours helps you quickly create slots that work for you.',
      cta: 'Set availability',
      link: '/admin/settings',
      priority: 'low',
    });
  }

  // Sort action items by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  actionItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return NextResponse.json({
    nextSession,
    openCapacity,
    upcomingSessions: upcomingSlots?.length || 0,
    attendanceRate,
    attendanceContext,
    actionItems: actionItems.slice(0, 3), // Limit to 3 action items
    setupItems,
    setupComplete: setupItems.filter(s => s.completed).length,
    setupTotal: setupItems.length,
    popularTimeSlots,
    recentBookings: recentBookings || [],
  });
}
