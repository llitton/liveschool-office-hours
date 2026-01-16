import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import type { RoutingQuestion } from '@/types';

// GET a single routing form with its rules
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

  const { data: form, error } = await supabase
    .from('oh_routing_forms')
    .select(`
      *,
      default_event:oh_events!default_event_id(id, name, slug),
      rules:oh_routing_rules(
        *,
        target_event:oh_events!target_event_id(id, name, slug),
        target_host:oh_admins!target_host_id(id, name, email, profile_image)
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Routing form not found' }, { status: 404 });
  }

  return NextResponse.json({ form });
}

// PATCH update a routing form
export async function PATCH(
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
    name,
    description,
    questions,
    default_event_id,
    is_active,
  }: {
    name?: string;
    description?: string;
    questions?: RoutingQuestion[];
    default_event_id?: string | null;
    is_active?: boolean;
  } = body;

  const supabase = getServiceSupabase();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (questions !== undefined) updates.questions = questions;
  if (default_event_id !== undefined) updates.default_event_id = default_event_id;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data: form, error } = await supabase
    .from('oh_routing_forms')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ form });
}

// DELETE a routing form
export async function DELETE(
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

  const { error } = await supabase
    .from('oh_routing_forms')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
