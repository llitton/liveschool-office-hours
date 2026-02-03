import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { getUserFriendlyError } from '@/lib/errors';

// GET sent resources for a booking
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

  const { data, error } = await supabase
    .from('oh_resource_sends')
    .select('resource_id, sent_at, sent_by')
    .eq('booking_id', bookingId);

  if (error) {
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
