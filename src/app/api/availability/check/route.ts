import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { checkTimeAvailability, getAvailableSlots } from '@/lib/availability';
import { parseISO, addDays } from 'date-fns';

// POST check if a specific time slot is available
export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { start_time, end_time, event_id, buffer_minutes } = body;

  if (!start_time || !end_time) {
    return NextResponse.json(
      { error: 'start_time and end_time are required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get admin ID
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  try {
    const result = await checkTimeAvailability(
      admin.id,
      parseISO(start_time),
      parseISO(end_time),
      event_id,
      buffer_minutes || 0
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to check availability:', error);
    return NextResponse.json(
      { error: 'Failed to check availability' },
      { status: 500 }
    );
  }
}

// GET available slots for a date range
export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const eventId = searchParams.get('event_id');
  const durationMinutes = parseInt(searchParams.get('duration_minutes') || '30', 10);
  const bufferMinutes = parseInt(searchParams.get('buffer_minutes') || '0', 10);

  const supabase = getServiceSupabase();

  // Get admin ID
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  try {
    const start = startDate ? parseISO(startDate) : new Date();
    const end = endDate ? parseISO(endDate) : addDays(start, 14);

    const slots = await getAvailableSlots(
      admin.id,
      durationMinutes,
      bufferMinutes,
      start,
      end,
      eventId || undefined
    );

    return NextResponse.json({
      slots: slots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
      })),
      count: slots.length,
    });
  } catch (error) {
    console.error('Failed to get available slots:', error);
    return NextResponse.json(
      { error: 'Failed to get available slots' },
      { status: 500 }
    );
  }
}
