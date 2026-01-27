import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { addDays } from 'date-fns';

// GET upcoming sessions for the current user (host or co-host)
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const daysAhead = parseInt(searchParams.get('days') || '7');

  const supabase = getServiceSupabase();
  const now = new Date();
  const endDate = addDays(now, daysAhead);

  // Get current admin's ID
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  // Get events where user is primary host or co-host
  const { data: hostedEvents } = await supabase
    .from('oh_events')
    .select('id')
    .eq('host_id', admin.id);

  const { data: coHostedEvents } = await supabase
    .from('oh_event_hosts')
    .select('event_id')
    .eq('admin_id', admin.id);

  // Combine event IDs
  const eventIds = new Set<string>();
  hostedEvents?.forEach(e => eventIds.add(e.id));
  coHostedEvents?.forEach(e => eventIds.add(e.event_id));

  if (eventIds.size === 0) {
    return NextResponse.json([]);
  }

  // Get upcoming slots with bookings for the user's events
  const { data: slots, error } = await supabase
    .from('oh_slots')
    .select(`
      id,
      start_time,
      end_time,
      google_meet_link,
      event:oh_events(
        id,
        name,
        slug,
        meeting_type,
        duration_minutes,
        host_name,
        description,
        custom_questions
      ),
      bookings:oh_bookings(
        id,
        first_name,
        last_name,
        email,
        question_responses,
        cancelled_at
      )
    `)
    .eq('is_cancelled', false)
    .in('event_id', Array.from(eventIds))
    .gte('start_time', now.toISOString())
    .lte('start_time', endDate.toISOString())
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching upcoming sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }

  // Transform data to include booking status
  const sessionsWithBookings = (slots || []).map(slot => {
    const bookings = (slot.bookings as Array<{
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      question_responses: Record<string, string> | null;
      cancelled_at: string | null;
    }>) || [];

    // Filter out cancelled bookings and add status
    const activeBookings = bookings
      .filter(b => !b.cancelled_at)
      .map(b => ({
        ...b,
        status: 'confirmed' as const,
      }));

    return {
      ...slot,
      bookings: activeBookings,
    };
  });

  return NextResponse.json(sessionsWithBookings);
}
