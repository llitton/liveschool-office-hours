import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { syncGoogleCalendarBusy } from '@/lib/availability';
import { addDays } from 'date-fns';
import { cronLogger } from '@/lib/logger';

// This cron job syncs Google Calendar busy times for all admins
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get all admins with Google tokens
  const { data: admins, error } = await supabase
    .from('oh_admins')
    .select('id, email, google_access_token, google_refresh_token')
    .not('google_access_token', 'is', null)
    .not('google_refresh_token', 'is', null);

  if (error) {
    console.error('Failed to fetch admins:', error);
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
  }

  const results = {
    total: admins?.length || 0,
    synced: 0,
    failed: 0,
    errors: [] as string[],
  };

  const startDate = new Date();
  const endDate = addDays(startDate, 30);

  for (const admin of admins || []) {
    try {
      await syncGoogleCalendarBusy(
        admin.id,
        admin.google_access_token!,
        admin.google_refresh_token!,
        startDate,
        endDate
      );
      results.synced++;
    } catch (error) {
      results.failed++;
      results.errors.push(`${admin.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`Failed to sync calendar for ${admin.email}:`, error);
    }
  }

  cronLogger.info('Availability sync completed', {
    operation: 'sync-availability',
    metadata: { synced: results.synced, failed: results.failed, errors: results.errors.length },
  });

  return NextResponse.json({
    success: true,
    ...results,
  });
}
