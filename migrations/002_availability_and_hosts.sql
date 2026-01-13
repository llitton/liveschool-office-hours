-- Migration: Availability Management and Multi-Host Support
-- Run this in your Supabase SQL editor

-- ============================================
-- PHASE 1A: AVAILABILITY MANAGEMENT
-- ============================================

-- Recurring availability patterns (e.g., "Tuesdays 2-4pm")
CREATE TABLE IF NOT EXISTS oh_availability_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES oh_admins(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_availability_patterns_admin
  ON oh_availability_patterns(admin_id, is_active);

-- Cached busy blocks from Google Calendar
CREATE TABLE IF NOT EXISTS oh_busy_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES oh_admins(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  source TEXT DEFAULT 'google_calendar', -- 'google_calendar', 'manual'
  external_event_id TEXT, -- Google Calendar event ID for reference
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_busy_blocks_admin_time
  ON oh_busy_blocks(admin_id, start_time, end_time);

-- ============================================
-- PHASE 1B: MULTI-HOST SUPPORT
-- ============================================

-- Add host_id to events (nullable for backward compatibility)
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES oh_admins(id);

-- Event co-hosts for shared events
CREATE TABLE IF NOT EXISTS oh_event_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES oh_events(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES oh_admins(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'host' CHECK (role IN ('owner', 'host', 'backup')),
  can_manage_slots BOOLEAN DEFAULT true,
  can_view_bookings BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, admin_id)
);

CREATE INDEX IF NOT EXISTS idx_event_hosts_admin ON oh_event_hosts(admin_id);
CREATE INDEX IF NOT EXISTS idx_event_hosts_event ON oh_event_hosts(event_id);

-- Slots can be assigned to specific hosts
ALTER TABLE oh_slots ADD COLUMN IF NOT EXISTS assigned_host_id UUID REFERENCES oh_admins(id);

-- ============================================
-- PHASE 2: HUBSPOT INTEGRATION
-- ============================================

-- HubSpot configuration
CREATE TABLE IF NOT EXISTS oh_hubspot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  portal_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add HubSpot contact ID to bookings for caching
ALTER TABLE oh_bookings ADD COLUMN IF NOT EXISTS hubspot_contact_id TEXT;

-- ============================================
-- PHASE 3: QUICK ACTIONS & SESSION TAGS
-- ============================================

-- Session outcome tags
CREATE TABLE IF NOT EXISTS oh_session_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6F71EE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default tags
INSERT INTO oh_session_tags (name, color) VALUES
  ('Resolved', '#417762'),
  ('Needs Follow-up', '#F4B03D'),
  ('Escalate', '#EF4444')
ON CONFLICT (name) DO NOTHING;

-- Tags applied to bookings
CREATE TABLE IF NOT EXISTS oh_booking_tags (
  booking_id UUID NOT NULL REFERENCES oh_bookings(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES oh_session_tags(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  applied_by UUID REFERENCES oh_admins(id),
  PRIMARY KEY(booking_id, tag_id)
);

-- Quick tasks created during sessions
CREATE TABLE IF NOT EXISTS oh_quick_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES oh_bookings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  hubspot_task_id TEXT, -- If synced to HubSpot
  created_by UUID REFERENCES oh_admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quick_tasks_booking ON oh_quick_tasks(booking_id);

-- ============================================
-- PHASE 4: SERIES BOOKINGS
-- ============================================

CREATE TABLE IF NOT EXISTS oh_booking_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_email TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES oh_events(id) ON DELETE CASCADE,
  recurrence_pattern TEXT NOT NULL CHECK (recurrence_pattern IN ('weekly', 'biweekly', 'monthly')),
  total_sessions INTEGER NOT NULL CHECK (total_sessions > 0 AND total_sessions <= 12),
  preferred_day INTEGER CHECK (preferred_day >= 0 AND preferred_day <= 6),
  preferred_time TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link bookings to series
ALTER TABLE oh_bookings ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES oh_booking_series(id);
ALTER TABLE oh_bookings ADD COLUMN IF NOT EXISTS series_sequence INTEGER;

-- ============================================
-- PHASE 5: SLACK NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS oh_slack_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_url TEXT NOT NULL,
  default_channel TEXT,
  notify_on_booking BOOLEAN DEFAULT true,
  daily_digest BOOLEAN DEFAULT true,
  daily_digest_time TIME DEFAULT '07:00',
  post_session_summary BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHASE 6: PRE-SESSION PREP RESOURCES
-- ============================================

CREATE TABLE IF NOT EXISTS oh_prep_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES oh_events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  link TEXT,
  keywords TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prep_resources_event ON oh_prep_resources(event_id, is_active);

-- Track which resources were sent to attendees
ALTER TABLE oh_bookings ADD COLUMN IF NOT EXISTS prep_resources_sent UUID[] DEFAULT '{}';

-- ============================================
-- PHASE 7: ANALYTICS
-- ============================================

CREATE TABLE IF NOT EXISTS oh_effectiveness_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES oh_events(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_bookings INTEGER DEFAULT 0,
  attended_count INTEGER DEFAULT 0,
  no_show_count INTEGER DEFAULT 0,
  cancelled_count INTEGER DEFAULT 0,
  feedback_count INTEGER DEFAULT 0,
  avg_feedback_rating DECIMAL(3,2),
  resolved_count INTEGER DEFAULT 0,
  follow_up_count INTEGER DEFAULT 0,
  escalated_count INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_effectiveness_event_period
  ON oh_effectiveness_metrics(event_id, period_start DESC);
