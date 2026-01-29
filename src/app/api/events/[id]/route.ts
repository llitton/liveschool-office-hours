import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { getUserFriendlyError, CommonErrors } from '@/lib/errors';

// GET single event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceSupabase();

  const { data: event, error } = await supabase
    .from('oh_events')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  return NextResponse.json(event);
}

// Whitelist of fields that can be updated via PATCH
// Sensitive fields like host_id, is_active, is_one_off are excluded
const ALLOWED_UPDATE_FIELDS = [
  // Basic info
  'name',
  'slug',
  'description',
  'subtitle',
  'banner_image',
  // Scheduling
  'duration_minutes',
  'max_attendees',
  'buffer_before',
  'buffer_after',
  'start_time_increment',
  // Host info (display only, not the actual host_id)
  'host_name',
  'host_email',
  // Booking rules
  'meeting_type',
  'min_notice_hours',
  'booking_window_days',
  'max_daily_bookings',
  'max_weekly_bookings',
  'require_approval',
  // Timezone
  'display_timezone',
  'lock_timezone',
  // Round-robin
  'round_robin_strategy',
  'round_robin_period',
  // Content
  'custom_questions',
  'prep_materials',
  // Guest settings
  'allow_guests',
  'guest_limit',
  // Email templates
  'confirmation_subject',
  'confirmation_body',
  'reminder_subject',
  'reminder_body',
  'cancellation_subject',
  'cancellation_body',
  // No-show re-engagement
  'no_show_subject',
  'no_show_body',
  'no_show_emails_enabled',
  'no_show_email_delay_hours',
  // SMS settings
  'sms_reminders_enabled',
  'sms_phone_required',
  'phone_required',
  'sms_reminder_24h_template',
  'sms_reminder_1h_template',
  // Waitlist
  'waitlist_enabled',
  'waitlist_limit',
  // Calendar behavior
  'ignore_busy_blocks',
  // HubSpot
  'hubspot_meeting_type',
  // Automated emails
  'automated_emails_enabled',
];

// PATCH update event (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = getServiceSupabase();

  // Filter body to only include allowed fields
  const filteredUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_UPDATE_FIELDS.includes(key)) {
      filteredUpdates[key] = value;
    }
  }

  // Warn if any fields were filtered out (for debugging)
  const filteredOut = Object.keys(body).filter(k => !ALLOWED_UPDATE_FIELDS.includes(k));
  if (filteredOut.length > 0) {
    console.warn(`Event PATCH: Filtered out disallowed fields: ${filteredOut.join(', ')}`);
  }

  if (Object.keys(filteredUpdates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data: event, error } = await supabase
    .from('oh_events')
    .update({
      ...filteredUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(event);
}

// DELETE event (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  const { error } = await supabase.from('oh_events').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
