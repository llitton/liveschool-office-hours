import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// POST - Save event configuration as a reusable template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, description, icon } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json(
      { error: 'Template name is required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get the event to copy from
  const { data: event, error: eventError } = await supabase
    .from('oh_events')
    .select('*')
    .eq('id', id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Get current admin ID
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  // Create template from event (excluding host-specific and identity fields)
  const templateData = {
    name: name.trim(),
    description: description || event.description || null,
    icon: icon || '📅',
    is_system: false,
    created_by: admin.id,
    // Core settings
    meeting_type: event.meeting_type,
    duration_minutes: event.duration_minutes,
    max_attendees: event.max_attendees,
    // Booking rules
    min_notice_hours: event.min_notice_hours,
    booking_window_days: event.booking_window_days,
    // Buffer times
    buffer_before: event.buffer_before || 15,
    buffer_after: event.buffer_after || 15,
    // Scheduling
    start_time_increment: event.start_time_increment || 30,
    require_approval: event.require_approval || false,
    // Timezone
    display_timezone: event.display_timezone,
    lock_timezone: event.lock_timezone || false,
    // Guest settings
    allow_guests: event.allow_guests || false,
    guest_limit: event.guest_limit || 0,
    // Content
    custom_questions: event.custom_questions || [],
    prep_materials: event.prep_materials,
    // Email templates
    confirmation_subject: event.confirmation_subject,
    confirmation_body: event.confirmation_body,
    reminder_subject: event.reminder_subject,
    reminder_body: event.reminder_body,
    cancellation_subject: event.cancellation_subject,
    cancellation_body: event.cancellation_body,
    // Waitlist
    waitlist_enabled: event.waitlist_enabled || false,
    waitlist_limit: event.waitlist_limit,
    // SMS
    sms_reminders_enabled: event.sms_reminders_enabled || false,
    sms_phone_required: event.sms_phone_required || false,
    phone_required: event.phone_required || false,
    // Round-robin
    round_robin_strategy: event.round_robin_strategy,
    round_robin_period: event.round_robin_period,
    // Extended fields (migration 033)
    subtitle: event.subtitle,
    banner_image: event.banner_image,
    no_show_subject: event.no_show_subject,
    no_show_body: event.no_show_body,
    no_show_emails_enabled: event.no_show_emails_enabled || false,
    no_show_email_delay_hours: event.no_show_email_delay_hours || 24,
    sms_reminder_24h_template: event.sms_reminder_24h_template,
    sms_reminder_1h_template: event.sms_reminder_1h_template,
    max_daily_bookings: event.max_daily_bookings,
    max_weekly_bookings: event.max_weekly_bookings,
    ignore_busy_blocks: event.ignore_busy_blocks || false,
  };

  const { data: template, error: templateError } = await supabase
    .from('oh_session_templates')
    .insert(templateData)
    .select()
    .single();

  if (templateError) {
    console.error('Failed to create template:', templateError);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }

  return NextResponse.json(template);
}
