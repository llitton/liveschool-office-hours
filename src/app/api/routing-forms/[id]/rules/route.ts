import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// GET all rules for a routing form
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  const { data: rules, error } = await supabase
    .from('oh_routing_rules')
    .select(`
      *,
      target_event:oh_events!target_event_id(id, name, slug),
      target_host:oh_admins!target_host_id(id, name, email, profile_image)
    `)
    .eq('routing_form_id', id)
    .order('priority', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rules });
}

// POST create a new rule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const {
    question_id,
    answer_value,
    target_event_id,
    target_host_id,
    priority,
  }: {
    question_id: string;
    answer_value: string;
    target_event_id: string;
    target_host_id?: string;
    priority?: number;
  } = body;

  if (!question_id || !answer_value || !target_event_id) {
    return NextResponse.json(
      { error: 'question_id, answer_value, and target_event_id are required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get max priority to set default
  const { data: maxPriorityRow } = await supabase
    .from('oh_routing_rules')
    .select('priority')
    .eq('routing_form_id', id)
    .order('priority', { ascending: false })
    .limit(1)
    .single();

  const nextPriority = priority ?? ((maxPriorityRow?.priority ?? -1) + 1);

  const { data: rule, error } = await supabase
    .from('oh_routing_rules')
    .insert({
      routing_form_id: id,
      question_id,
      answer_value,
      target_event_id,
      target_host_id: target_host_id || null,
      priority: nextPriority,
      is_active: true,
    })
    .select(`
      *,
      target_event:oh_events!target_event_id(id, name, slug),
      target_host:oh_admins!target_host_id(id, name, email, profile_image)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rule }, { status: 201 });
}

// PATCH update a rule (by rule_id in query param)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await params; // Consume params
  const { searchParams } = new URL(request.url);
  const ruleId = searchParams.get('rule_id');

  if (!ruleId) {
    return NextResponse.json({ error: 'rule_id query param is required' }, { status: 400 });
  }

  const body = await request.json();
  const {
    question_id,
    answer_value,
    target_event_id,
    target_host_id,
    priority,
    is_active,
  }: {
    question_id?: string;
    answer_value?: string;
    target_event_id?: string;
    target_host_id?: string | null;
    priority?: number;
    is_active?: boolean;
  } = body;

  const supabase = getServiceSupabase();

  const updates: Record<string, unknown> = {};

  if (question_id !== undefined) updates.question_id = question_id;
  if (answer_value !== undefined) updates.answer_value = answer_value;
  if (target_event_id !== undefined) updates.target_event_id = target_event_id;
  if (target_host_id !== undefined) updates.target_host_id = target_host_id;
  if (priority !== undefined) updates.priority = priority;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data: rule, error } = await supabase
    .from('oh_routing_rules')
    .update(updates)
    .eq('id', ruleId)
    .select(`
      *,
      target_event:oh_events!target_event_id(id, name, slug),
      target_host:oh_admins!target_host_id(id, name, email, profile_image)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rule });
}

// DELETE a rule (by rule_id in query param)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await params; // Consume params
  const { searchParams } = new URL(request.url);
  const ruleId = searchParams.get('rule_id');

  if (!ruleId) {
    return NextResponse.json({ error: 'rule_id query param is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from('oh_routing_rules')
    .delete()
    .eq('id', ruleId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
