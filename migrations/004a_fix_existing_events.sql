-- Migration: 004a_fix_existing_events.sql
-- Fix existing events to have default values for new columns

-- Set meeting_type to 'group' for existing events (original behavior)
UPDATE oh_events SET meeting_type = 'group' WHERE meeting_type IS NULL;

-- Set display_timezone to America/New_York for existing events
UPDATE oh_events SET display_timezone = 'America/New_York' WHERE display_timezone IS NULL;

-- Set lock_timezone to false for existing events
UPDATE oh_events SET lock_timezone = false WHERE lock_timezone IS NULL;

-- Set allow_guests to false for existing events
UPDATE oh_events SET allow_guests = false WHERE allow_guests IS NULL;

-- Set guest_limit to 0 for existing events
UPDATE oh_events SET guest_limit = 0 WHERE guest_limit IS NULL;
