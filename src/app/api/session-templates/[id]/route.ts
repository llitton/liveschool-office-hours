import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// GET - Get a single template by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceSupabase();

  const { data: template, error } = await supabase
    .from('oh_session_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json(template);
}

// PUT - Update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  // Check if template exists and is not a system template
  const { data: existing } = await supabase
    .from('oh_session_templates')
    .select('is_system')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  if (existing.is_system) {
    return NextResponse.json({ error: 'Cannot edit system templates' }, { status: 403 });
  }

  const body = await request.json();

  // Build update object with only allowed fields
  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    'name',
    'description',
    'icon',
    'meeting_type',
    'duration_minutes',
    'max_attendees',
    'min_notice_hours',
    'booking_window_days',
    'buffer_before',
    'buffer_after',
    'start_time_increment',
    'require_approval',
    'display_timezone',
    'lock_timezone',
    'allow_guests',
    'guest_limit',
    'custom_questions',
    'prep_materials',
    'confirmation_subject',
    'confirmation_body',
    'reminder_subject',
    'reminder_body',
    'cancellation_subject',
    'cancellation_body',
    'waitlist_enabled',
    'waitlist_limit',
    'sms_reminders_enabled',
    'sms_phone_required',
    'phone_required',
    'round_robin_strategy',
    'round_robin_period',
    'subtitle',
    'banner_image',
    'no_show_subject',
    'no_show_body',
    'no_show_emails_enabled',
    'no_show_email_delay_hours',
    'sms_reminder_24h_template',
    'sms_reminder_1h_template',
    'max_daily_bookings',
    'max_weekly_bookings',
    'ignore_busy_blocks',
  ];

  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field];
    }
  }

  // Validate required fields
  if ('name' in updateData && (!updateData.name || typeof updateData.name !== 'string')) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const { data: template, error } = await supabase
    .from('oh_session_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }

  return NextResponse.json(template);
}

// DELETE - Delete a custom template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  // Check if it's a system template
  const { data: template } = await supabase
    .from('oh_session_templates')
    .select('is_system')
    .eq('id', id)
    .single();

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  if (template.is_system) {
    return NextResponse.json({ error: 'Cannot delete system templates' }, { status: 403 });
  }

  const { error } = await supabase
    .from('oh_session_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
