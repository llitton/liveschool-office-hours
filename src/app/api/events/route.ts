import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// GET all events (public)
export async function GET() {
  const supabase = getServiceSupabase();

  const { data: events, error } = await supabase
    .from('oh_events')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(events);
}

// POST create new event (admin only)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    slug,
    description,
    duration_minutes = 30,
    host_name,
    host_email,
    max_attendees = 30,
    buffer_minutes = 15,
    // New fields for Sprint 1-2
    meeting_type = 'group',
    min_notice_hours = 24,
    booking_window_days = 60,
    max_daily_bookings = null,
    max_weekly_bookings = null,
    require_approval = false,
    display_timezone = 'America/New_York',
    lock_timezone = false,
    // Round-robin settings
    round_robin_strategy = 'cycle',
    round_robin_period = 'week',
    round_robin_hosts = [],
  } = body;

  if (!name || !slug) {
    return NextResponse.json(
      { error: 'Name and slug are required' },
      { status: 400 }
    );
  }

  // Validate round-robin requires at least 2 hosts
  if (meeting_type === 'round_robin' && round_robin_hosts.length < 2) {
    return NextResponse.json(
      { error: 'Round-robin events require at least 2 team members' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get admin ID for the current session
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  const { data: event, error } = await supabase
    .from('oh_events')
    .insert({
      name,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      description,
      duration_minutes,
      host_name: host_name || session.name || 'Host',
      host_email: host_email || session.email,
      max_attendees,
      buffer_minutes,
      host_id: admin?.id || null,
      // New fields
      meeting_type,
      min_notice_hours,
      booking_window_days,
      max_daily_bookings,
      max_weekly_bookings,
      require_approval,
      display_timezone,
      lock_timezone,
      // Round-robin settings
      round_robin_strategy: meeting_type === 'round_robin' ? round_robin_strategy : null,
      round_robin_period: meeting_type === 'round_robin' ? round_robin_period : 'week',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'An event with this slug already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For round-robin events, add the selected hosts
  if (meeting_type === 'round_robin' && round_robin_hosts.length > 0) {
    const hostEntries = round_robin_hosts.map((adminId: string) => ({
      event_id: event.id,
      admin_id: adminId,
      role: 'host',
      can_manage_slots: true,
      can_view_bookings: true,
    }));

    const { error: hostsError } = await supabase
      .from('oh_event_hosts')
      .insert(hostEntries);

    if (hostsError) {
      console.error('Failed to add round-robin hosts:', hostsError);
    }
  }

  return NextResponse.json(event);
}
