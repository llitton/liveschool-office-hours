import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { getUserFriendlyError, CommonErrors, safeParseJSON } from '@/lib/errors';

// GET all events (public)
export async function GET() {
  const supabase = getServiceSupabase();

  // Select only fields needed for public listing and admin dashboard
  // Excludes: email templates, SMS templates, round-robin config, internal flags
  const { data: events, error } = await supabase
    .from('oh_events')
    .select(`
      id,
      slug,
      name,
      subtitle,
      description,
      duration_minutes,
      host_name,
      host_email,
      host_id,
      max_attendees,
      is_active,
      created_at,
      meeting_type,
      custom_questions,
      prep_materials,
      banner_image,
      display_timezone,
      phone_required,
      sms_reminders_enabled,
      sms_phone_required,
      guest_limit,
      allow_guests,
      is_one_off,
      single_use,
      one_off_expires_at,
      one_off_booked_at,
      ignore_busy_blocks,
      display_order,
      host:oh_admins!host_id(profile_image)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
  }

  // Flatten host profile_image into the event object
  const eventsWithHostImage = events?.map(event => {
    const hostData = Array.isArray(event.host) ? event.host[0] : event.host;
    return {
      ...event,
      host_profile_image: hostData?.profile_image || null,
      host: undefined, // Remove the nested host object
    };
  });

  return NextResponse.json(eventsWithHostImage);
}

// POST create new event (admin only)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: CommonErrors.UNAUTHORIZED }, { status: 401 });
  }

  const body = await safeParseJSON<Record<string, unknown> & { round_robin_hosts?: string[] }>(request);
  if (!body) {
    return NextResponse.json({ error: CommonErrors.VALIDATION_ERROR }, { status: 400 });
  }
  const {
    name,
    slug,
    description,
    subtitle = null,
    duration_minutes = 30,
    host_name,
    host_email,
    max_attendees = 30,
    buffer_before = 15,
    buffer_after = 15,
    // Booking rules
    meeting_type = 'group',
    min_notice_hours = 24,
    booking_window_days = 60,
    max_daily_bookings = null,
    max_weekly_bookings = null,
    require_approval = false,
    start_time_increment = 30,
    display_timezone = 'America/New_York',
    lock_timezone = false,
    // Round-robin settings
    round_robin_strategy = 'cycle',
    round_robin_period = 'week',
    round_robin_hosts = [],
    // Template-provided fields
    banner_image = null,
    custom_questions = null,
    prep_materials = null,
    allow_guests = false,
    guest_limit = 0,
    // Email templates
    confirmation_subject = null,
    confirmation_body = null,
    reminder_subject = null,
    reminder_body = null,
    cancellation_subject = null,
    cancellation_body = null,
    // No-show re-engagement
    no_show_subject = null,
    no_show_body = null,
    no_show_emails_enabled = false,
    no_show_email_delay_hours = 24,
    // SMS settings
    sms_reminders_enabled = false,
    sms_phone_required = false,
    phone_required = false,
    sms_reminder_24h_template = null,
    sms_reminder_1h_template = null,
    // Waitlist
    waitlist_enabled = false,
    waitlist_limit = null,
    // Calendar behavior
    ignore_busy_blocks = false,
  } = body;

  if (!name || !slug) {
    return NextResponse.json(
      { error: 'Name and slug are required' },
      { status: 400 }
    );
  }

  if (typeof name !== 'string' || name.length > 200) {
    return NextResponse.json(
      { error: 'Event name must be 200 characters or less' },
      { status: 400 }
    );
  }

  if (typeof slug !== 'string' || slug.length > 100) {
    return NextResponse.json(
      { error: 'Event slug must be 100 characters or less' },
      { status: 400 }
    );
  }

  if (description && (typeof description !== 'string' || description.length > 5000)) {
    return NextResponse.json(
      { error: 'Description must be 5000 characters or less' },
      { status: 400 }
    );
  }

  // Validate host_email belongs to a registered admin if provided
  if (host_email && host_email !== session.email) {
    const supabaseCheck = getServiceSupabase();
    const { data: hostAdmin } = await supabaseCheck
      .from('oh_admins')
      .select('id')
      .eq('email', host_email)
      .single();

    if (!hostAdmin) {
      return NextResponse.json(
        { error: 'host_email must belong to a registered team member' },
        { status: 400 }
      );
    }
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
      subtitle,
      duration_minutes,
      host_name: host_name || session.name || 'Host',
      host_email: host_email || session.email,
      max_attendees,
      buffer_before,
      buffer_after,
      host_id: admin?.id || null,
      // Booking rules
      meeting_type,
      min_notice_hours,
      booking_window_days,
      max_daily_bookings,
      max_weekly_bookings,
      require_approval,
      start_time_increment,
      display_timezone,
      lock_timezone,
      // Round-robin settings
      round_robin_strategy: meeting_type === 'round_robin' ? round_robin_strategy : null,
      round_robin_period: meeting_type === 'round_robin' ? round_robin_period : 'week',
      // Content
      banner_image,
      custom_questions,
      prep_materials,
      allow_guests,
      guest_limit,
      // Email templates
      confirmation_subject,
      confirmation_body,
      reminder_subject,
      reminder_body,
      cancellation_subject,
      cancellation_body,
      // No-show re-engagement
      no_show_subject,
      no_show_body,
      no_show_emails_enabled,
      no_show_email_delay_hours,
      // SMS settings
      sms_reminders_enabled,
      sms_phone_required,
      phone_required,
      sms_reminder_24h_template,
      sms_reminder_1h_template,
      // Waitlist
      waitlist_enabled,
      waitlist_limit,
      // Calendar behavior
      ignore_busy_blocks,
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
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
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
