import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { safeParseJSON } from '@/lib/errors';
import type { OHSessionTemplate } from '@/types';

// GET - List all session templates (admin only)
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get admin ID to scope custom templates
  const { data: templateAdmin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  // Return system templates + custom templates created by this user
  const { data: templates, error } = await supabase
    .from('oh_session_templates')
    .select('*')
    .or(`is_system.eq.true,created_by.eq.${templateAdmin?.id || '00000000-0000-0000-0000-000000000000'}`)
    .order('is_system', { ascending: false })
    .order('name');

  if (error) {
    console.error('Failed to fetch session templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }

  return NextResponse.json(templates);
}

// POST - Create a new custom template (admin only)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const body = await safeParseJSON(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    name,
    description,
    icon,
    meeting_type,
    duration_minutes,
    max_attendees,
    min_notice_hours,
    booking_window_days,
    custom_questions,
    prep_materials,
  } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  if (name.length > 200) {
    return NextResponse.json({ error: 'Name must be 200 characters or less' }, { status: 400 });
  }

  // Get admin ID for created_by attribution
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  const { data: template, error } = await supabase
    .from('oh_session_templates')
    .insert({
      name,
      description: description || null,
      icon: icon || '📅',
      meeting_type: meeting_type || 'group',
      duration_minutes: duration_minutes || 30,
      max_attendees: max_attendees || 10,
      min_notice_hours: min_notice_hours || 24,
      booking_window_days: booking_window_days || 30,
      custom_questions: custom_questions || [],
      prep_materials: prep_materials || null,
      is_system: false,
      created_by: admin?.id || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create session template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }

  return NextResponse.json(template, { status: 201 });
}

// DELETE - Delete a custom template (admin only, not system templates)
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get('id');

  if (!templateId) {
    return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
  }

  // Get admin ID for ownership check
  const { data: delTemplateAdmin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  // Check if it's a system template and verify ownership
  const { data: template } = await supabase
    .from('oh_session_templates')
    .select('is_system, created_by')
    .eq('id', templateId)
    .single();

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  if (template.is_system) {
    return NextResponse.json({ error: 'Cannot delete system templates' }, { status: 403 });
  }

  // Verify the requesting admin created this template
  if (template.created_by && delTemplateAdmin && template.created_by !== delTemplateAdmin.id) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('oh_session_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    console.error('Failed to delete session template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
