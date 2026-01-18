import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAvailableSlots, getCollectiveAvailableSlots, syncGoogleCalendarBusy } from '@/lib/availability';
import { getParticipatingHosts } from '@/lib/round-robin';
import { addHours, addDays, isBefore, isAfter, parseISO } from 'date-fns';

interface DynamicSlot {
  id: string;
  event_id: string;
  start_time: string;
  end_time: string;
  is_dynamic: true;
  booking_count: number;
}

interface DatabaseSlot {
  id: string;
  event_id: string;
  start_time: string;
  end_time: string;
  google_event_id: string | null;
  google_meet_link: string | null;
  is_cancelled: boolean;
  created_at: string;
  booking_count: number;
  assigned_host?: { id: string; name: string | null; email: string } | null;
}

// GET available times for an event
// For webinars: returns pre-created slots from database
// For non-webinars: returns dynamically generated slots based on host availability
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const includeAll = searchParams.get('includeAll') === 'true';

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

  // Get the host admin separately
  const { data: adminData } = await supabase
    .from('oh_admins')
    .select('id, google_access_token, google_refresh_token')
    .eq('email', event.host_email)
    .single();

  // Attach admin to event for compatibility
  const eventWithAdmin = { ...event, admin: adminData };

  // Calculate constraint boundaries
  const now = new Date();
  const minNoticeHours = event.min_notice_hours ?? 24;
  const bookingWindowDays = event.booking_window_days ?? 60;
  const earliestBookable = addHours(now, minNoticeHours);
  const latestBookable = addDays(now, bookingWindowDays);

  // WEBINARS: Use existing slot-based system
  if (event.meeting_type === 'webinar') {
    const { data: slots, error: slotsError } = await supabase
      .from('oh_slots')
      .select(`
        *,
        bookings:oh_bookings(count),
        assigned_host:oh_admins!assigned_host_id(id, name, email)
      `)
      .eq('event_id', eventId)
      .eq('is_cancelled', false)
      .gte('start_time', now.toISOString())
      .order('start_time', { ascending: true });

    if (slotsError) {
      return NextResponse.json({ error: slotsError.message }, { status: 500 });
    }

    // Transform and filter by constraints
    const slotsWithCounts: DatabaseSlot[] = (slots || [])
      .map((slot) => ({
        ...slot,
        booking_count: slot.bookings?.[0]?.count || 0,
      }))
      .filter((slot) => {
        if (includeAll) return true;
        const slotStart = parseISO(slot.start_time);
        if (isBefore(slotStart, earliestBookable)) return false;
        if (isAfter(slotStart, latestBookable)) return false;
        return true;
      });

    return NextResponse.json({
      slots: slotsWithCounts,
      is_dynamic: false,
      meeting_type: event.meeting_type,
    });
  }

  // NON-WEBINARS: Generate dynamic availability
  // Use the host admin we fetched earlier
  const admin = adminData;

  if (!admin) {
    // No host found - return empty
    return NextResponse.json({
      slots: [],
      is_dynamic: true,
      meeting_type: event.meeting_type,
      error: 'No host configured for this event',
    });
  }

  // Sync calendar busy times if Google is connected
  if (admin.google_access_token && admin.google_refresh_token) {
    try {
      await syncGoogleCalendarBusy(
        admin.id,
        admin.google_access_token,
        admin.google_refresh_token,
        earliestBookable,
        latestBookable
      );
    } catch (err) {
      console.warn('Failed to sync Google Calendar busy times:', err);
      // Continue with cached data
    }
  }

  // Generate slots based on meeting type
  let dynamicSlots: { start: Date; end: Date }[] = [];
  const bufferBefore = event.buffer_before || 0;
  const bufferAfter = event.buffer_after || 0;
  const startTimeIncrement = event.start_time_increment || 30;

  if (event.meeting_type === 'collective') {
    // Collective: All hosts must be available
    const collectiveHosts = await getParticipatingHosts(eventId);
    if (collectiveHosts.length > 0) {
      dynamicSlots = await getCollectiveAvailableSlots(
        collectiveHosts,
        event.duration_minutes,
        earliestBookable,
        latestBookable,
        eventId,
        startTimeIncrement
      );
    }
  } else {
    // One-on-one, group, round-robin, panel: Use primary host's availability
    dynamicSlots = await getAvailableSlots(
      admin.id,
      event.duration_minutes,
      bufferBefore,
      bufferAfter,
      earliestBookable,
      latestBookable,
      eventId,
      startTimeIncrement
    );
  }

  // For round-robin, we need to check availability across all participating hosts
  // and find times when at least one host is available
  if (event.meeting_type === 'round_robin') {
    const participatingHosts = await getParticipatingHosts(eventId);
    if (participatingHosts.length > 1) {
      // Get availability for each host
      const allHostSlots = await Promise.all(
        participatingHosts.map(async (hostId) => {
          try {
            return await getAvailableSlots(
              hostId,
              event.duration_minutes,
              bufferBefore,
              bufferAfter,
              earliestBookable,
              latestBookable,
              eventId,
              startTimeIncrement
            );
          } catch {
            return [];
          }
        })
      );

      // Merge all slots (union) - time is available if ANY host is free
      const slotMap = new Map<string, { start: Date; end: Date }>();
      for (const hostSlots of allHostSlots) {
        for (const slot of hostSlots) {
          const key = slot.start.toISOString();
          if (!slotMap.has(key)) {
            slotMap.set(key, slot);
          }
        }
      }
      dynamicSlots = Array.from(slotMap.values()).sort(
        (a, b) => a.start.getTime() - b.start.getTime()
      );
    }
  }

  // Convert to API response format with unique IDs
  const formattedSlots: DynamicSlot[] = dynamicSlots.map((slot) => ({
    id: `dynamic-${slot.start.toISOString()}`, // Temporary ID for dynamic slots
    event_id: eventId,
    start_time: slot.start.toISOString(),
    end_time: slot.end.toISOString(),
    is_dynamic: true,
    booking_count: 0, // Dynamic slots are always available
  }));

  return NextResponse.json({
    slots: formattedSlots,
    is_dynamic: true,
    meeting_type: event.meeting_type,
    total_count: formattedSlots.length,
  });
}
