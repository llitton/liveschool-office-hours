import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { syncGoogleCalendarBusy } from '@/lib/availability';
import { addDays } from 'date-fns';

// POST trigger manual sync of Google Calendar busy times
export async function POST() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!session.google_access_token || !session.google_refresh_token) {
    return NextResponse.json(
      { error: 'Google Calendar not connected' },
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
    // Sync busy times for next 30 days
    const startDate = new Date();
    const endDate = addDays(startDate, 30);

    await syncGoogleCalendarBusy(
      admin.id,
      session.google_access_token,
      session.google_refresh_token,
      startDate,
      endDate
    );

    // Get count of synced blocks
    const { count } = await supabase
      .from('oh_busy_blocks')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', admin.id);

    return NextResponse.json({
      success: true,
      message: 'Calendar synced successfully',
      busyBlocksCount: count || 0,
      syncedUntil: endDate.toISOString(),
    });
  } catch (error) {
    console.error('Failed to sync calendar:', error);
    return NextResponse.json(
      { error: 'Failed to sync with Google Calendar' },
      { status: 500 }
    );
  }
}

// GET current sync status
export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  // Get most recent sync time and count
  const { data: busyBlocks, count } = await supabase
    .from('oh_busy_blocks')
    .select('synced_at', { count: 'exact' })
    .eq('admin_id', admin.id)
    .eq('source', 'google_calendar')
    .order('synced_at', { ascending: false })
    .limit(1);

  const lastSynced = busyBlocks?.[0]?.synced_at || null;

  return NextResponse.json({
    googleConnected: !!(session.google_access_token && session.google_refresh_token),
    lastSynced,
    busyBlocksCount: count || 0,
  });
}
