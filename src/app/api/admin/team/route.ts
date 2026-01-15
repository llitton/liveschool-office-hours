import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// GET all admins (for team selection)
export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get admin details including settings
  const { data: admins, error } = await supabase
    .from('oh_admins')
    .select(`
      id,
      name,
      email,
      created_at,
      google_access_token,
      max_meetings_per_day,
      max_meetings_per_week,
      default_buffer_before,
      default_buffer_after
    `)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get timezone and availability hours for each admin from their patterns
  const adminIds = admins?.map(a => a.id) || [];

  const { data: patterns } = await supabase
    .from('oh_availability_patterns')
    .select('admin_id, timezone, day_of_week, start_time, end_time')
    .in('admin_id', adminIds)
    .eq('is_active', true);

  // Calculate timezone and weekly hours per admin
  const adminExtras: Record<string, { timezone: string | null; weeklyHours: number }> = {};

  for (const adminId of adminIds) {
    const adminPatterns = patterns?.filter(p => p.admin_id === adminId) || [];

    // Get timezone from first pattern (all patterns should have same timezone)
    const timezone = adminPatterns.length > 0 ? adminPatterns[0].timezone : null;

    // Calculate total weekly hours from patterns
    let weeklyHours = 0;
    for (const pattern of adminPatterns) {
      const startParts = pattern.start_time.split(':').map(Number);
      const endParts = pattern.end_time.split(':').map(Number);
      const startMinutes = startParts[0] * 60 + startParts[1];
      const endMinutes = endParts[0] * 60 + endParts[1];
      weeklyHours += (endMinutes - startMinutes) / 60;
    }

    adminExtras[adminId] = { timezone, weeklyHours };
  }

  // Merge admin data with extras
  const enrichedAdmins = admins?.map(admin => ({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    created_at: admin.created_at,
    google_connected: !!admin.google_access_token,
    max_meetings_per_day: admin.max_meetings_per_day,
    max_meetings_per_week: admin.max_meetings_per_week,
    default_buffer_before: admin.default_buffer_before,
    default_buffer_after: admin.default_buffer_after,
    timezone: adminExtras[admin.id]?.timezone || null,
    weekly_available_hours: adminExtras[admin.id]?.weeklyHours || 0,
  }));

  return NextResponse.json(enrichedAdmins);
}

// POST add new admin
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { email, name } = body;

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Check if admin already exists
  const { data: existing } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    return NextResponse.json({ error: 'This email is already a team member' }, { status: 400 });
  }

  const { data: admin, error } = await supabase
    .from('oh_admins')
    .insert({
      email: email.toLowerCase(),
      name: name || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(admin);
}

// DELETE remove admin
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const adminId = searchParams.get('id');

  if (!adminId) {
    return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { error } = await supabase.from('oh_admins').delete().eq('id', adminId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
