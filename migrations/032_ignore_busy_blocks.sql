-- ============================================
-- MIGRATION 032: Allow Any Time (Ignore Busy Blocks)
-- ============================================
-- Add option to bypass availability patterns AND Google Calendar conflict checking.
-- When enabled, slots are generated for all hours (6am-10pm) regardless of
-- defined availability patterns or calendar events. Useful for internal booking links.

ALTER TABLE oh_events
ADD COLUMN IF NOT EXISTS ignore_busy_blocks BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN oh_events.ignore_busy_blocks IS
'When true, skip availability patterns AND Google Calendar busy block checks. Slots are generated for 6am-10pm. Useful for internal booking links where the admin controls access.';
