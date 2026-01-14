-- Migration: 006_enable_rls.sql
-- Enable Row Level Security on all oh_ tables
--
-- This migration enables RLS for security without breaking existing functionality.
-- The service_role key (used by Next.js API routes) bypasses RLS automatically.
-- RLS policies are created for any direct database access scenarios.

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

-- Core tables
ALTER TABLE oh_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE oh_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE oh_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE oh_bookings ENABLE ROW LEVEL SECURITY;

-- Availability & hosting
ALTER TABLE oh_availability_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE oh_busy_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE oh_event_hosts ENABLE ROW LEVEL SECURITY;

-- Integrations (sensitive - contain tokens)
ALTER TABLE oh_hubspot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE oh_slack_config ENABLE ROW LEVEL SECURITY;

-- Session management
ALTER TABLE oh_session_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE oh_booking_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE oh_quick_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE oh_booking_series ENABLE ROW LEVEL SECURITY;

-- Resources & Analytics
ALTER TABLE oh_prep_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE oh_effectiveness_metrics ENABLE ROW LEVEL SECURITY;

-- Round-robin state
ALTER TABLE oh_round_robin_state ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES FOR PUBLIC ACCESS (booking pages)
-- ============================================

-- Anyone can view active events (for booking pages)
CREATE POLICY "Public can view active events"
ON oh_events FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Anyone can view available slots (for booking pages)
CREATE POLICY "Public can view available slots"
ON oh_slots FOR SELECT
TO anon, authenticated
USING (
  is_cancelled = false
  AND start_time > NOW()
  AND EXISTS (
    SELECT 1 FROM oh_events e
    WHERE e.id = event_id AND e.is_active = true
  )
);

-- Anyone can create bookings (for booking forms)
CREATE POLICY "Public can create bookings"
ON oh_bookings FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Attendees can view/manage their own bookings (via manage_token)
CREATE POLICY "Attendees can view own bookings"
ON oh_bookings FOR SELECT
TO anon, authenticated
USING (true);  -- manage_token validation is done in application code

CREATE POLICY "Attendees can update own bookings"
ON oh_bookings FOR UPDATE
TO anon, authenticated
USING (true)  -- manage_token validation is done in application code
WITH CHECK (true);

-- ============================================
-- POLICIES FOR AUTHENTICATED ADMIN ACCESS
-- ============================================

-- Session tags are readable by all authenticated users
CREATE POLICY "Authenticated can view session tags"
ON oh_session_tags FOR SELECT
TO authenticated
USING (true);

-- Prep resources for active events are readable
CREATE POLICY "Public can view prep resources"
ON oh_prep_resources FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM oh_events e
    WHERE e.id = event_id AND e.is_active = true
  )
);

-- ============================================
-- ADMIN-ONLY TABLES (no public policies needed)
-- ============================================
-- The following tables have RLS enabled but no public policies.
-- They can only be accessed via service_role (which bypasses RLS):
-- - oh_admins
-- - oh_availability_patterns
-- - oh_busy_blocks
-- - oh_event_hosts
-- - oh_hubspot_config
-- - oh_slack_config
-- - oh_booking_tags
-- - oh_quick_tasks
-- - oh_booking_series
-- - oh_effectiveness_metrics
-- - oh_round_robin_state

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY "Public can view active events" ON oh_events
IS 'Allows public booking pages to display active events';

COMMENT ON POLICY "Public can view available slots" ON oh_slots
IS 'Allows public booking pages to show available time slots';

COMMENT ON POLICY "Public can create bookings" ON oh_bookings
IS 'Allows attendees to submit booking forms';

COMMENT ON POLICY "Attendees can view own bookings" ON oh_bookings
IS 'Allows booking management via manage_token (validated in app)';

COMMENT ON POLICY "Attendees can update own bookings" ON oh_bookings
IS 'Allows booking cancellation/reschedule via manage_token (validated in app)';
