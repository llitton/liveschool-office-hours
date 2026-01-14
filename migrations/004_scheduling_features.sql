-- Migration: 004_scheduling_features.sql
-- Sprint 1-2: Core Scheduling Foundation
-- Features: Booking Constraints, Meeting Types, Timezone Support

-- ============================================
-- 1.1 BOOKING CONSTRAINTS
-- ============================================

-- Add booking constraint columns to oh_events
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS min_notice_hours INTEGER DEFAULT 24;
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS max_daily_bookings INTEGER;
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS max_weekly_bookings INTEGER;
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS booking_window_days INTEGER DEFAULT 60;
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT false;

-- Add personal limits to oh_admins
ALTER TABLE oh_admins ADD COLUMN IF NOT EXISTS max_meetings_per_day INTEGER DEFAULT 8;
ALTER TABLE oh_admins ADD COLUMN IF NOT EXISTS max_meetings_per_week INTEGER DEFAULT 30;
ALTER TABLE oh_admins ADD COLUMN IF NOT EXISTS default_buffer_before INTEGER DEFAULT 0;
ALTER TABLE oh_admins ADD COLUMN IF NOT EXISTS default_buffer_after INTEGER DEFAULT 15;

-- ============================================
-- 1.2 MEETING TYPES
-- ============================================

-- Create meeting type enum (using text with check constraint for flexibility)
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS meeting_type TEXT DEFAULT 'group';

-- Add check constraint for valid meeting types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oh_events_meeting_type_check'
  ) THEN
    ALTER TABLE oh_events ADD CONSTRAINT oh_events_meeting_type_check
    CHECK (meeting_type IN ('one_on_one', 'group', 'collective', 'round_robin', 'panel'));
  END IF;
END $$;

-- Add guest support columns
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN DEFAULT false;
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS guest_limit INTEGER DEFAULT 0;

-- ============================================
-- 1.3 TIMEZONE SUPPORT
-- ============================================

-- Add timezone columns to oh_events
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS display_timezone TEXT DEFAULT 'America/New_York';
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS lock_timezone BOOLEAN DEFAULT false;

-- Add attendee timezone tracking to oh_bookings
ALTER TABLE oh_bookings ADD COLUMN IF NOT EXISTS attendee_timezone TEXT;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for booking limits queries (count bookings per day/week)
CREATE INDEX IF NOT EXISTS idx_oh_bookings_slot_created
ON oh_bookings(slot_id, created_at)
WHERE cancelled_at IS NULL;

-- Index for meeting type filtering
CREATE INDEX IF NOT EXISTS idx_oh_events_meeting_type
ON oh_events(meeting_type)
WHERE is_active = true;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN oh_events.min_notice_hours IS 'Minimum hours notice required before booking (e.g., 24 = no same-day bookings)';
COMMENT ON COLUMN oh_events.max_daily_bookings IS 'Maximum bookings per day for this event (null = unlimited)';
COMMENT ON COLUMN oh_events.max_weekly_bookings IS 'Maximum bookings per week for this event (null = unlimited)';
COMMENT ON COLUMN oh_events.booking_window_days IS 'How many days in advance bookings can be made';
COMMENT ON COLUMN oh_events.require_approval IS 'If true, bookings require admin approval before confirmation';
COMMENT ON COLUMN oh_events.meeting_type IS 'Type: one_on_one, group, collective, round_robin, panel';
COMMENT ON COLUMN oh_events.allow_guests IS 'Whether attendees can add additional guests';
COMMENT ON COLUMN oh_events.guest_limit IS 'Maximum number of additional guests allowed (if allow_guests is true)';
COMMENT ON COLUMN oh_events.display_timezone IS 'Timezone for displaying times on booking page';
COMMENT ON COLUMN oh_events.lock_timezone IS 'If true, always show times in display_timezone (no auto-detect)';
COMMENT ON COLUMN oh_bookings.attendee_timezone IS 'Timezone detected/selected by attendee at booking time';
COMMENT ON COLUMN oh_admins.max_meetings_per_day IS 'Personal daily meeting limit across all events';
COMMENT ON COLUMN oh_admins.max_meetings_per_week IS 'Personal weekly meeting limit across all events';
COMMENT ON COLUMN oh_admins.default_buffer_before IS 'Default minutes of buffer time before meetings';
COMMENT ON COLUMN oh_admins.default_buffer_after IS 'Default minutes of buffer time after meetings';
