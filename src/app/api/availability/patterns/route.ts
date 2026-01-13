import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// GET availability patterns for current admin
export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get admin ID from email
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  const { data: patterns, error } = await supabase
    .from('oh_availability_patterns')
    .select('*')
    .eq('admin_id', admin.id)
    .order('day_of_week', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(patterns);
}

// POST create new availability pattern
export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { day_of_week, start_time, end_time, timezone } = body;

  if (day_of_week === undefined || !start_time || !end_time) {
    return NextResponse.json(
      { error: 'day_of_week, start_time, and end_time are required' },
      { status: 400 }
    );
  }

  // Validate day_of_week
  if (day_of_week < 0 || day_of_week > 6) {
    return NextResponse.json(
      { error: 'day_of_week must be between 0 (Sunday) and 6 (Saturday)' },
      { status: 400 }
    );
  }

  // Validate time format (HH:mm or HH:mm:ss)
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
    return NextResponse.json(
      { error: 'Invalid time format. Use HH:mm or HH:mm:ss' },
      { status: 400 }
    );
  }

  // Validate start is before end
  if (start_time >= end_time) {
    return NextResponse.json(
      { error: 'start_time must be before end_time' },
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

  // Normalize time format to HH:mm:ss
  const normalizeTime = (time: string) =>
    time.length === 5 ? `${time}:00` : time;

  const { data: pattern, error } = await supabase
    .from('oh_availability_patterns')
    .insert({
      admin_id: admin.id,
      day_of_week,
      start_time: normalizeTime(start_time),
      end_time: normalizeTime(end_time),
      timezone: timezone || 'America/New_York',
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(pattern, { status: 201 });
}

// PUT update multiple patterns (bulk update)
export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { patterns } = body;

  if (!Array.isArray(patterns)) {
    return NextResponse.json(
      { error: 'patterns must be an array' },
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

  // Delete existing patterns
  await supabase
    .from('oh_availability_patterns')
    .delete()
    .eq('admin_id', admin.id);

  // Insert new patterns
  if (patterns.length > 0) {
    const normalizeTime = (time: string) =>
      time.length === 5 ? `${time}:00` : time;

    const patternsToInsert = patterns.map((p: {
      day_of_week: number;
      start_time: string;
      end_time: string;
      timezone?: string;
    }) => ({
      admin_id: admin.id,
      day_of_week: p.day_of_week,
      start_time: normalizeTime(p.start_time),
      end_time: normalizeTime(p.end_time),
      timezone: p.timezone || 'America/New_York',
      is_active: true,
    }));

    const { error } = await supabase
      .from('oh_availability_patterns')
      .insert(patternsToInsert);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Return updated patterns
  const { data: updatedPatterns } = await supabase
    .from('oh_availability_patterns')
    .select('*')
    .eq('admin_id', admin.id)
    .order('day_of_week', { ascending: true });

  return NextResponse.json(updatedPatterns);
}

// DELETE a specific pattern
export async function DELETE(request: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const patternId = searchParams.get('id');

  if (!patternId) {
    return NextResponse.json(
      { error: 'Pattern ID is required' },
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

  // Delete pattern (only if owned by this admin)
  const { error } = await supabase
    .from('oh_availability_patterns')
    .delete()
    .eq('id', patternId)
    .eq('admin_id', admin.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
