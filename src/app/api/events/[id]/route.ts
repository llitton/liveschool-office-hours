import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { getUserFriendlyError, CommonErrors, safeParseJSON } from '@/lib/errors';

// Helper: verify the requesting admin hosts or co-hosts this event
async function verifyEventAccess(supabase: ReturnType<typeof getServiceSupabase>, eventId: string, sessionEmail: string): Promise<boolean> {
  // Check if primary host
  const { data: primaryEvent } = await supabase
    .from('oh_events')
    .select('id')
    .eq('id', eventId)
    .eq('host_email', sessionEmail)
    .single();

  if (primaryEvent) return true;

  // Check if co-host
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', sessionEmail)
    .single();

  if (admin) {
    const { data: coHostEntry } = await supabase
      .from('oh_event_hosts')
      .select('id')
      .eq('event_id', eventId)
      .eq('admin_id', admin.id)
      .single();

    if (coHostEntry) return true;
  }

  return false;
}

// GET single event (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: CommonErrors.UNAUTHORIZED }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  const { data: event, error } = await supabase
    .from('oh_events')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Verify the requesting admin hosts or co-hosts this event
  const hasAccess = await verifyEventAccess(supabase, id, session.email);
  if (!hasAccess) {
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
  const body = await safeParseJSON(request);
  if (!body) {
    return NextResponse.json({ error: CommonErrors.VALIDATION_ERROR }, { status: 400 });
  }
  const supabase = getServiceSupabase();

  // Verify the requesting admin hosts or co-hosts this event
  const hasPatchAccess = await verifyEventAccess(supabase, id, session.email);
  if (!hasPatchAccess) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

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
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
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

  // Verify the requesting admin hosts or co-hosts this event
  const hasDeleteAccess = await verifyEventAccess(supabase, id, session.email);
  if (!hasDeleteAccess) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Check for active (non-cancelled) bookings
  const { data: slots } = await supabase
    .from('oh_slots')
    .select('id')
    .eq('event_id', id);

  if (slots && slots.length > 0) {
    const slotIds = slots.map((s) => s.id);

    const { count } = await supabase
      .from('oh_bookings')
      .select('id', { count: 'exact', head: true })
      .in('slot_id', slotIds)
      .is('cancelled_at', null);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete event with ${count} active booking(s). Cancel them first.` },
        { status: 400 }
      );
    }

    // Delete bookings (cancelled ones) for these slots
    await supabase.from('oh_bookings').delete().in('slot_id', slotIds);
  }

  // Clean up related data before deleting the event
  await supabase.from('oh_slots').delete().eq('event_id', id);
  await supabase.from('oh_event_hosts').delete().eq('event_id', id);
  await supabase.from('oh_round_robin_state').delete().eq('event_id', id);
  await supabase.from('oh_prep_resources').delete().eq('event_id', id);

  const { error } = await supabase.from('oh_events').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
