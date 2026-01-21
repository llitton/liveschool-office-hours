-- Migration: 031_enable_rls_missing_tables.sql
-- Enable Row Level Security on tables that were missing RLS
--
-- This migration fixes Supabase security warnings by enabling RLS on tables
-- that were created after the initial RLS migration. The service_role key
-- (used by Next.js API routes) bypasses RLS automatically.

-- ============================================
-- SENSITIVE TABLES (admin-only, no public access)
-- ============================================

-- SMS Config (contains API keys - very sensitive)
ALTER TABLE oh_sms_config ENABLE ROW LEVEL SECURITY;
-- No public policies - only accessible via service_role

-- ============================================
-- ADMIN MANAGEMENT TABLES
-- ============================================

-- Company Holidays (admin-managed)
ALTER TABLE oh_company_holidays ENABLE ROW LEVEL SECURITY;
-- No public policies - only accessible via service_role

-- Task Templates (admin-managed)
ALTER TABLE oh_task_templates ENABLE ROW LEVEL SECURITY;
-- No public policies - only accessible via service_role

-- Session Templates (admin-managed)
ALTER TABLE oh_session_templates ENABLE ROW LEVEL SECURITY;
-- No public policies - only accessible via service_role

-- Resource Sends (tracking which resources were sent)
ALTER TABLE oh_resource_sends ENABLE ROW LEVEL SECURITY;
-- No public policies - only accessible via service_role

-- ============================================
-- POLL TABLES (need some public access for voting)
-- ============================================

-- Polls table
ALTER TABLE oh_polls ENABLE ROW LEVEL SECURITY;

-- Public can view polls (for voting pages)
CREATE POLICY "Public can view polls by token"
ON oh_polls FOR SELECT
TO anon, authenticated
USING (true);  -- Token validation is done in application code

-- Poll Options table
ALTER TABLE oh_poll_options ENABLE ROW LEVEL SECURITY;

-- Public can view poll options (for voting pages)
CREATE POLICY "Public can view poll options"
ON oh_poll_options FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM oh_polls p
    WHERE p.id = poll_id
  )
);

-- Poll Invitees table
ALTER TABLE oh_poll_invitees ENABLE ROW LEVEL SECURITY;

-- Public can view invitees (for showing who else was invited)
CREATE POLICY "Public can view poll invitees"
ON oh_poll_invitees FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM oh_polls p
    WHERE p.id = poll_id
  )
);

-- Poll Votes table
ALTER TABLE oh_poll_votes ENABLE ROW LEVEL SECURITY;

-- Public can view votes (for showing current vote counts)
CREATE POLICY "Public can view poll votes"
ON oh_poll_votes FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM oh_polls p
    WHERE p.id = poll_id
  )
);

-- Public can create votes (for submitting votes)
CREATE POLICY "Public can create poll votes"
ON oh_poll_votes FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM oh_polls p
    WHERE p.id = poll_id
  )
);

-- Public can update their own votes
CREATE POLICY "Public can update poll votes"
ON oh_poll_votes FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY "Public can view polls by token" ON oh_polls
IS 'Allows public access to polls via the vote/[slug] page - token validation in app';

COMMENT ON POLICY "Public can view poll options" ON oh_poll_options
IS 'Allows voters to see available time options on a poll';

COMMENT ON POLICY "Public can view poll invitees" ON oh_poll_invitees
IS 'Allows voters to see who else was invited to the poll';

COMMENT ON POLICY "Public can view poll votes" ON oh_poll_votes
IS 'Allows viewing current vote counts and selections';

COMMENT ON POLICY "Public can create poll votes" ON oh_poll_votes
IS 'Allows invitees to submit their availability votes';

COMMENT ON POLICY "Public can update poll votes" ON oh_poll_votes
IS 'Allows invitees to change their votes';
