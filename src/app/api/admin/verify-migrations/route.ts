import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

// Key columns/tables to check for each migration
// Format: { migration: string, table: string, column: string }
const migrationChecks = [
  // 002 - Availability and hosts
  { migration: '002', table: 'oh_availability_patterns', column: 'id' },
  { migration: '002', table: 'oh_event_hosts', column: 'id' },
  // 003 - Event banner images
  { migration: '003', table: 'oh_events', column: 'banner_image' },
  // 004 - Scheduling features
  { migration: '004', table: 'oh_events', column: 'buffer_before' },
  { migration: '004', table: 'oh_events', column: 'buffer_after' },
  // 005 - Round robin
  { migration: '005', table: 'oh_round_robin_state', column: 'id' },
  // 006 - Enable RLS (verifies RLS-protected table is accessible via service role)
  { migration: '006', table: 'oh_hubspot_config', column: 'id' },
  // 007 - Routing forms
  { migration: '007', table: 'oh_routing_forms', column: 'id' },
  // 008 - SMS reminders
  { migration: '008', table: 'oh_sms_config', column: 'id' },
  // 009 - Webinar type (check constraint, hard to verify)
  { migration: '009', table: 'oh_events', column: 'meeting_type' },
  // 010 - No show reengagement
  { migration: '010', table: 'oh_events', column: 'no_show_emails_enabled' },
  // 011 - Task templates
  { migration: '011', table: 'oh_task_templates', column: 'id' },
  // 012 - Resource sends tracking table
  { migration: '012', table: 'oh_resource_sends', column: 'id' },
  // 013 - Task template HubSpot sync
  { migration: '013', table: 'oh_task_templates', column: 'sync_to_hubspot' },
  // 014 - Waitlist
  { migration: '014', table: 'oh_events', column: 'waitlist_enabled' },
  // 015 - Session templates
  { migration: '015', table: 'oh_session_templates', column: 'id' },
  // 016 - Onboarding
  { migration: '016', table: 'oh_admins', column: 'onboarding_progress' },
  // 017 - Host priority
  { migration: '017', table: 'oh_event_hosts', column: 'priority' },
  // 018 - One off meetings
  { migration: '018', table: 'oh_events', column: 'is_one_off' },
  // 019 - Meeting polls
  { migration: '019', table: 'oh_polls', column: 'id' },
  // 020 - Start time increments
  { migration: '020', table: 'oh_events', column: 'start_time_increment' },
  // 021 - Quick links token
  { migration: '021', table: 'oh_admins', column: 'quick_links_token' },
  // 022 - Phone required
  { migration: '022', table: 'oh_events', column: 'phone_required' },
  // 023 - Cancellation reason
  { migration: '023', table: 'oh_bookings', column: 'cancellation_reason' },
  // 024 - Guest emails
  { migration: '024', table: 'oh_bookings', column: 'guest_emails' },
  // 025 - SMS logs
  { migration: '025', table: 'oh_sms_logs', column: 'id' },
  // 026 - Booking analytics (creates oh_booking_analytics table)
  { migration: '026', table: 'oh_booking_analytics', column: 'session_id' },
  // 027 - Event templates expand
  { migration: '027', table: 'oh_session_templates', column: 'confirmation_subject' },
  // 028 - Company holidays
  { migration: '028', table: 'oh_company_holidays', column: 'id' },
  // 029 - Priority strategy
  { migration: '029', table: 'oh_events', column: 'round_robin_strategy' },
  // 030 - HubSpot meeting type
  { migration: '030', table: 'oh_events', column: 'hubspot_meeting_type' },
  // 031 - Enable RLS on poll tables (verify by checking poll_options is accessible)
  { migration: '031', table: 'oh_poll_options', column: 'id' },
  // 032 - Ignore busy blocks
  { migration: '032', table: 'oh_events', column: 'ignore_busy_blocks' },
  // 033 - Expand templates
  { migration: '033', table: 'oh_session_templates', column: 'ignore_busy_blocks' },
  // 034 - Add CHECK constraints (structural - verifies affected tables exist)
  { migration: '034', table: 'oh_slots', column: 'start_time' },
  // 035 - Atomic booking creation (structural - verifies bookings table for unique index)
  { migration: '035', table: 'oh_bookings', column: 'slot_id' },
  // 036 - Event display order
  { migration: '036', table: 'oh_events', column: 'display_order' },
  // 037 - Event Slack notifications
  { migration: '037', table: 'oh_events', column: 'slack_notifications_enabled' },
  // 038 - Changelog tracking
  { migration: '038', table: 'oh_admins', column: 'last_seen_changelog_at' },
  // 039 - Invitation tracking
  { migration: '039', table: 'oh_admins', column: 'invitation_sent_at' },
  { migration: '039', table: 'oh_admins', column: 'invitation_last_sent_at' },
  // 040 - Feedback topics
  { migration: '040', table: 'oh_bookings', column: 'feedback_topic_suggestion' },
  // 041 - Slot resources (deck link, shared links)
  { migration: '041', table: 'oh_slots', column: 'deck_link' },
  { migration: '041', table: 'oh_slots', column: 'shared_links' },
  // 042 - Email tracking (prevent duplicate automated emails)
  { migration: '042', table: 'oh_bookings', column: 'followup_sent_at' },
  { migration: '042', table: 'oh_bookings', column: 'no_show_email_sent_at' },
  { migration: '042', table: 'oh_bookings', column: 'feedback_sent_at' },
  // 043 - Automated emails toggle
  { migration: '043', table: 'oh_events', column: 'automated_emails_enabled' },
  // 044 - Per-slot skip automated emails
  { migration: '044', table: 'oh_slots', column: 'skip_automated_emails' },
];

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const results: Array<{
    migration: string;
    table: string;
    column: string;
    exists: boolean;
    error?: string;
  }> = [];

  // Check each migration's key column by attempting to select it
  for (const check of migrationChecks) {
    try {
      const { error: queryError } = await supabase
        .from(check.table)
        .select(check.column)
        .limit(0);

      // If no error, column exists
      // Error code 42703 = column does not exist
      // Error code 42P01 = table does not exist
      const exists = !queryError ||
        (!queryError.message?.includes('does not exist') &&
         !queryError.code?.startsWith('42'));

      results.push({
        ...check,
        exists,
        error: queryError?.message,
      });
    } catch (err) {
      results.push({
        ...check,
        exists: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Group results by migration
  const byMigration = results.reduce((acc, result) => {
    if (!acc[result.migration]) {
      acc[result.migration] = [];
    }
    acc[result.migration].push(result);
    return acc;
  }, {} as Record<string, typeof results>);

  // Determine status per migration
  const migrationStatus = Object.entries(byMigration).map(([migration, checks]) => ({
    migration,
    status: checks.every((c) => c.exists) ? 'complete' : 'missing',
    checks,
  }));

  // Summary
  const complete = migrationStatus.filter((m) => m.status === 'complete').length;
  const missing = migrationStatus.filter((m) => m.status === 'missing');

  return NextResponse.json({
    summary: {
      total: migrationStatus.length,
      complete,
      missing: missing.length,
      allComplete: missing.length === 0,
    },
    missingMigrations: missing.map((m) => ({
      migration: m.migration,
      missingColumns: m.checks
        .filter((c) => !c.exists)
        .map((c) => `${c.table}.${c.column}`),
    })),
    details: migrationStatus,
  });
}
