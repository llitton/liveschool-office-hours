import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// PATCH /api/bookings/[id]/attendance - Update attendance status
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
  const { status } = body; // 'attended' | 'no_show' | 'reset'

  if (!['attended', 'no_show', 'reset'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status. Use: attended, no_show, or reset' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const updates: Record<string, string | null> = {};

  if (status === 'attended') {
    updates.attended_at = new Date().toISOString();
    updates.no_show_at = null;
  } else if (status === 'no_show') {
    updates.no_show_at = new Date().toISOString();
    updates.attended_at = null;
  } else if (status === 'reset') {
    updates.attended_at = null;
    updates.no_show_at = null;
  }

  const { data, error } = await supabase
    .from('oh_bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 });
  }

  return NextResponse.json({ success: true, booking: data });
}
