import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// GET routing form by slug (public endpoint)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = getServiceSupabase();

  const { data: form, error } = await supabase
    .from('oh_routing_forms')
    .select('id, slug, name, description, questions')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !form) {
    return NextResponse.json({ error: 'Routing form not found' }, { status: 404 });
  }

  return NextResponse.json({ form });
}
