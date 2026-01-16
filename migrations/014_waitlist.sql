-- Migration: Add waitlist functionality for capacity management
-- This allows events to accept bookings beyond capacity as waitlist entries

-- Add waitlist settings to events
ALTER TABLE oh_events
ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS waitlist_limit INTEGER DEFAULT NULL;

-- Add waitlist fields to bookings
ALTER TABLE oh_bookings
ADD COLUMN IF NOT EXISTS is_waitlisted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS waitlist_position INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promoted_from_waitlist_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS waitlist_notification_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient waitlist queries
CREATE INDEX IF NOT EXISTS idx_bookings_waitlist
ON oh_bookings(slot_id, is_waitlisted, waitlist_position)
WHERE is_waitlisted = true AND cancelled_at IS NULL;

-- Comment for documentation
COMMENT ON COLUMN oh_events.waitlist_enabled IS 'Whether to allow waitlist signups when capacity is reached';
COMMENT ON COLUMN oh_events.waitlist_limit IS 'Maximum number of waitlist entries (null = unlimited)';
COMMENT ON COLUMN oh_bookings.is_waitlisted IS 'Whether this booking is on the waitlist (not confirmed)';
COMMENT ON COLUMN oh_bookings.waitlist_position IS 'Position in waitlist queue (1 = next to be promoted)';
COMMENT ON COLUMN oh_bookings.promoted_from_waitlist_at IS 'When this booking was promoted from waitlist to confirmed';
