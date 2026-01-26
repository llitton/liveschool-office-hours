import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

interface StatusCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checks: StatusCheck[] = [];
  const supabase = getServiceSupabase();

  // 1. Database connectivity
  try {
    const { count, error } = await supabase
      .from('oh_admins')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    checks.push({
      name: 'Database',
      status: 'ok',
      message: 'Connected to Supabase',
      details: { adminCount: count },
    });
  } catch (error) {
    checks.push({
      name: 'Database',
      status: 'error',
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // 2. Environment variables
  const envVars = {
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    CRON_SECRET: !!process.env.CRON_SECRET,
  };

  const missingEnvVars = Object.entries(envVars)
    .filter(([, set]) => !set)
    .map(([name]) => name);

  checks.push({
    name: 'Environment Variables',
    status: missingEnvVars.length === 0 ? 'ok' : 'error',
    message: missingEnvVars.length === 0
      ? 'All required environment variables set'
      : `Missing: ${missingEnvVars.join(', ')}`,
    details: {
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
      configured: envVars,
    },
  });

  // 3. Google Calendar integration
  try {
    const { data: adminsWithGoogle, error } = await supabase
      .from('oh_admins')
      .select('id, email, google_access_token, google_refresh_token')
      .not('google_access_token', 'is', null);

    if (error) throw error;

    const totalAdmins = await supabase
      .from('oh_admins')
      .select('id', { count: 'exact', head: true });

    const connectedCount = adminsWithGoogle?.length || 0;
    const totalCount = totalAdmins.count || 0;
    const allConnected = connectedCount === totalCount && totalCount > 0;

    checks.push({
      name: 'Google Calendar',
      status: allConnected ? 'ok' : connectedCount > 0 ? 'warning' : 'error',
      message: `${connectedCount}/${totalCount} admins connected`,
      details: {
        connected: adminsWithGoogle?.map(a => a.email) || [],
      },
    });
  } catch (error) {
    checks.push({
      name: 'Google Calendar',
      status: 'error',
      message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // 4. HubSpot integration
  try {
    const { data: hubspotConfig } = await supabase
      .from('oh_hubspot_config')
      .select('*')
      .eq('is_active', true)
      .single();

    checks.push({
      name: 'HubSpot',
      status: hubspotConfig ? 'ok' : 'warning',
      message: hubspotConfig ? 'Connected and active' : 'Not configured',
      details: hubspotConfig ? {
        portalId: hubspotConfig.portal_id,
        syncContacts: hubspotConfig.sync_contacts,
        syncMeetings: hubspotConfig.sync_meetings,
      } : undefined,
    });
  } catch {
    checks.push({
      name: 'HubSpot',
      status: 'warning',
      message: 'Not configured',
    });
  }

  // 5. Slack integration
  try {
    const { data: slackConfig } = await supabase
      .from('oh_slack_config')
      .select('*')
      .eq('is_active', true)
      .single();

    checks.push({
      name: 'Slack',
      status: slackConfig ? 'ok' : 'warning',
      message: slackConfig ? 'Connected and active' : 'Not configured',
      details: slackConfig ? {
        notifyOnBooking: slackConfig.notify_on_booking,
        dailyDigest: slackConfig.daily_digest,
      } : undefined,
    });
  } catch {
    checks.push({
      name: 'Slack',
      status: 'warning',
      message: 'Not configured',
    });
  }

  // 6. SMS integration
  try {
    const { data: smsConfig } = await supabase
      .from('oh_sms_config')
      .select('*')
      .eq('is_active', true)
      .single();

    checks.push({
      name: 'SMS',
      status: smsConfig ? 'ok' : 'warning',
      message: smsConfig ? `${smsConfig.provider} configured` : 'Not configured',
      details: smsConfig ? {
        provider: smsConfig.provider,
      } : undefined,
    });
  } catch {
    checks.push({
      name: 'SMS',
      status: 'warning',
      message: 'Not configured',
    });
  }

  // 7. Active events check
  try {
    const { count: activeEvents } = await supabase
      .from('oh_events')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: totalSlots } = await supabase
      .from('oh_slots')
      .select('*', { count: 'exact', head: true })
      .eq('is_cancelled', false)
      .gte('start_time', new Date().toISOString());

    checks.push({
      name: 'Events & Slots',
      status: (activeEvents || 0) > 0 ? 'ok' : 'warning',
      message: `${activeEvents || 0} active events, ${totalSlots || 0} upcoming slots`,
      details: {
        activeEvents,
        upcomingSlots: totalSlots,
      },
    });
  } catch (error) {
    checks.push({
      name: 'Events & Slots',
      status: 'error',
      message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // 8. Recent bookings (activity check)
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentBookings } = await supabase
      .from('oh_bookings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);

    checks.push({
      name: 'Recent Activity',
      status: 'ok',
      message: `${recentBookings || 0} bookings in last 24 hours`,
      details: {
        bookingsLast24h: recentBookings,
      },
    });
  } catch (error) {
    checks.push({
      name: 'Recent Activity',
      status: 'error',
      message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // Calculate overall status
  const hasErrors = checks.some(c => c.status === 'error');
  const hasWarnings = checks.some(c => c.status === 'warning');
  const overallStatus = hasErrors ? 'error' : hasWarnings ? 'warning' : 'ok';

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
}
