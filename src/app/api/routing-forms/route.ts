import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { generateSlug } from '@/lib/routing';
import type { RoutingQuestion } from '@/types';

// GET all routing forms (admin)
export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  const { data: forms, error } = await supabase
    .from('oh_routing_forms')
    .select(`
      *,
      default_event:oh_events!default_event_id(id, name, slug)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ forms });
}

// POST create a new routing form
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    description,
    questions,
    default_event_id,
  }: {
    name: string;
    description?: string;
    questions: RoutingQuestion[];
    default_event_id?: string;
  } = body;

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Generate slug from name
  let slug = generateSlug(name);

  // Check if slug exists and make unique
  const { data: existing } = await supabase
    .from('oh_routing_forms')
    .select('slug')
    .eq('slug', slug)
    .single();

  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const { data: form, error } = await supabase
    .from('oh_routing_forms')
    .insert({
      slug,
      name,
      description: description || null,
      questions: questions || [],
      default_event_id: default_event_id || null,
      is_active: true,
      submission_count: 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ form }, { status: 201 });
}
