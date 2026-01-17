-- ============================================
-- MIGRATION 018: One-off Meetings
-- ============================================
-- Single-use scheduling links for quick, one-time meetings

-- Add one-off meeting fields to events
ALTER TABLE oh_events
ADD COLUMN IF NOT EXISTS is_one_off BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS single_use BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS one_off_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS one_off_booked_at TIMESTAMPTZ;

-- Index for finding active one-off meetings
CREATE INDEX IF NOT EXISTS idx_events_one_off
ON oh_events(is_one_off, single_use, one_off_booked_at)
WHERE is_one_off = true;

-- Comments for documentation
COMMENT ON COLUMN oh_events.is_one_off IS
'True if this is a one-off meeting (quick scheduling link)';

COMMENT ON COLUMN oh_events.single_use IS
'True if link expires after first booking';

COMMENT ON COLUMN oh_events.one_off_expires_at IS
'When this one-off meeting link expires (optional)';

COMMENT ON COLUMN oh_events.one_off_booked_at IS
'When the single-use link was booked (makes it inactive)';
