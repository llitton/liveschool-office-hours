import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { createCalendarEvent } from '@/lib/google';
import { nanoid } from 'nanoid';

// GET list one-off meetings for the current user
export async function GET() {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get admin ID
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  // Get one-off meetings created by this admin
  const { data: events, error } = await supabase
    .from('oh_events')
    .select(`
      *,
      slots:oh_slots(
        id,
        start_time,
        end_time,
        is_cancelled,
        bookings:oh_bookings(count)
      )
    `)
    .eq('is_one_off', true)
    .eq('host_id', admin.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with status
  const enrichedEvents = (events || []).map((event) => {
    const totalSlots = event.slots?.length || 0;
    const bookedSlots = event.slots?.filter(
      (s: { bookings: { count: number }[] }) => s.bookings?.[0]?.count > 0
    ).length || 0;

    let status: 'active' | 'booked' | 'expired' = 'active';
    if (event.single_use && event.one_off_booked_at) {
      status = 'booked';
    } else if (event.one_off_expires_at && new Date(event.one_off_expires_at) < new Date()) {
      status = 'expired';
    }

    return {
      ...event,
      status,
      total_slots: totalSlots,
      booked_slots: bookedSlots,
    };
  });

  return NextResponse.json(enrichedEvents);
}

// POST create a new one-off meeting
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    duration_minutes = 30,
    time_slots, // Array of { start: ISO string, end: ISO string }
    single_use = true,
    expires_at,
    description,
    co_host_ids = [],
  } = body;

  if (!name) {
    return NextResponse.json({ error: 'Meeting name is required' }, { status: 400 });
  }

  if (!time_slots || time_slots.length === 0) {
    return NextResponse.json({ error: 'At least one time slot is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Get admin
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  // Generate unique slug
  const slug = `one-off-${nanoid(10)}`;

  // Create the one-off event
  const { data: event, error: eventError } = await supabase
    .from('oh_events')
    .insert({
      slug,
      name,
      description: description || null,
      duration_minutes,
      host_name: admin.name || admin.email.split('@')[0],
      host_email: admin.email,
      host_id: admin.id,
      max_attendees: 1,
      is_active: true,
      meeting_type: co_host_ids.length > 0 ? 'collective' : 'one_on_one',
      is_one_off: true,
      single_use,
      one_off_expires_at: expires_at || null,
      min_notice_hours: 0, // No minimum notice for one-off
      booking_window_days: 365,
    })
    .select()
    .single();

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  // Add co-hosts if specified
  if (co_host_ids.length > 0) {
    const hostInserts = co_host_ids.map((hostId: string) => ({
      event_id: event.id,
      admin_id: hostId,
      role: 'host',
    }));

    // Also add the creator as owner
    hostInserts.unshift({
      event_id: event.id,
      admin_id: admin.id,
      role: 'owner',
    });

    await supabase.from('oh_event_hosts').insert(hostInserts);
  }

  // Create slots for each offered time
  const slotInserts = [];
  const createdSlots = [];

  for (const slot of time_slots) {
    let googleEventId: string | null = null;
    let googleMeetLink: string | null = null;

    // Create calendar event with Google Meet
    if (admin.google_access_token && admin.google_refresh_token) {
      try {
        // Get co-host emails for collective meetings
        let coHostEmails: string[] = [];
        if (co_host_ids.length > 0) {
          const { data: coHosts } = await supabase
            .from('oh_admins')
            .select('email')
            .in('id', co_host_ids);
          coHostEmails = coHosts?.map(h => h.email) || [];
        }

        const calendarResult = await createCalendarEvent(
          admin.google_access_token,
          admin.google_refresh_token,
          {
            summary: `[Connect] ${name}`,
            description: description || '',
            startTime: slot.start,
            endTime: slot.end,
            hostEmail: admin.email,
            coHostEmails: coHostEmails.length > 0 ? coHostEmails : undefined,
          }
        );
        googleEventId = calendarResult.eventId || null;
        googleMeetLink = calendarResult.meetLink;
      } catch (err) {
        console.error('Failed to create calendar event:', err);
      }
    }

    slotInserts.push({
      event_id: event.id,
      start_time: slot.start,
      end_time: slot.end,
      google_event_id: googleEventId,
      google_meet_link: googleMeetLink,
    });

    createdSlots.push({
      start_time: slot.start,
      end_time: slot.end,
      google_meet_link: googleMeetLink,
    });
  }

  const { error: slotsError } = await supabase
    .from('oh_slots')
    .insert(slotInserts);

  if (slotsError) {
    // Clean up event if slots failed
    await supabase.from('oh_events').delete().eq('id', event.id);
    return NextResponse.json({ error: slotsError.message }, { status: 500 });
  }

  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://connect.liveschool.io'}/book/${slug}`;

  return NextResponse.json({
    id: event.id,
    slug,
    name,
    booking_url: bookingUrl,
    slots: createdSlots,
    single_use,
    expires_at: expires_at || null,
  });
}

// DELETE a one-off meeting
export async function DELETE(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('id');

  if (!eventId) {
    return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Verify ownership
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  const { data: event } = await supabase
    .from('oh_events')
    .select('id, host_id, is_one_off')
    .eq('id', eventId)
    .single();

  if (!event || event.host_id !== admin.id) {
    return NextResponse.json({ error: 'Not authorized to delete this meeting' }, { status: 403 });
  }

  if (!event.is_one_off) {
    return NextResponse.json({ error: 'This is not a one-off meeting' }, { status: 400 });
  }

  // Delete the event (cascades to slots and bookings)
  const { error } = await supabase
    .from('oh_events')
    .delete()
    .eq('id', eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
