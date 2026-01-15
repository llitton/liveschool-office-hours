import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  // Get the original event
  const { data: originalEvent, error: fetchError } = await supabase
    .from('oh_events')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !originalEvent) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Generate a unique slug
  let newSlug = `${originalEvent.slug}-copy`;
  let slugCounter = 1;

  while (true) {
    const { data: existingSlug } = await supabase
      .from('oh_events')
      .select('id')
      .eq('slug', newSlug)
      .single();

    if (!existingSlug) break;

    slugCounter++;
    newSlug = `${originalEvent.slug}-copy-${slugCounter}`;
  }

  // Create the duplicate event
  const { data: newEvent, error: createError } = await supabase
    .from('oh_events')
    .insert({
      slug: newSlug,
      name: `${originalEvent.name} (Copy)`,
      description: originalEvent.description,
      duration_minutes: originalEvent.duration_minutes,
      host_name: originalEvent.host_name,
      host_email: originalEvent.host_email,
      max_attendees: originalEvent.max_attendees,
      buffer_before: originalEvent.buffer_before,
      buffer_after: originalEvent.buffer_after,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (createError) {
    console.error('Error duplicating event:', createError);
    return NextResponse.json(
      { error: 'Failed to duplicate event' },
      { status: 500 }
    );
  }

  return NextResponse.json(newEvent);
}
