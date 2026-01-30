import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// Debug endpoint to find a booking by email
// GET /api/debug/find-booking?email=agunn@theabowmanacademy.org
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = request.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'email parameter required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data: bookings, error } = await supabase
    .from('oh_bookings')
    .select('id, first_name, last_name, email, attended_at, no_show_at, created_at, slot:oh_slots(id, start_time, event:oh_events(name))')
    .ilike('email', `%${email}%`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: 'Failed to search bookings' }, { status: 500 });
  }

  return NextResponse.json({ bookings });
}
