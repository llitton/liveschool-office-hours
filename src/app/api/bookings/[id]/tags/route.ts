import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// GET tags for a booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await params;
  const supabase = getServiceSupabase();

  const { data: bookingTags, error } = await supabase
    .from('oh_booking_tags')
    .select(`
      *,
      tag:oh_session_tags(*)
    `)
    .eq('booking_id', bookingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(bookingTags.map((bt) => bt.tag));
}

// POST add a tag to a booking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await params;
  const body = await request.json();
  const { tag_id } = body;

  if (!tag_id) {
    return NextResponse.json({ error: 'tag_id is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Check if tag is already applied
  const { data: existing } = await supabase
    .from('oh_booking_tags')
    .select('booking_id')
    .eq('booking_id', bookingId)
    .eq('tag_id', tag_id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'Tag is already applied to this booking' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('oh_booking_tags')
    .insert({
      booking_id: bookingId,
      tag_id,
    })
    .select(`
      *,
      tag:oh_session_tags(*)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data.tag);
}

// DELETE remove a tag from a booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await params;
  const { searchParams } = new URL(request.url);
  const tagId = searchParams.get('tagId');

  if (!tagId) {
    return NextResponse.json({ error: 'tagId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from('oh_booking_tags')
    .delete()
    .eq('booking_id', bookingId)
    .eq('tag_id', tagId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
