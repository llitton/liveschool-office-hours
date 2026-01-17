-- ============================================
-- MIGRATION 020: Start Time Increments
-- ============================================
-- Control how often booking slots appear (every 15, 30, 45, 60 min)

-- Add start_time_increment field to events
ALTER TABLE oh_events
ADD COLUMN IF NOT EXISTS start_time_increment INTEGER DEFAULT 30
CHECK (start_time_increment IN (15, 30, 45, 60));

-- Comment for documentation
COMMENT ON COLUMN oh_events.start_time_increment IS
'How often slots appear: 15, 30, 45, or 60 minutes. Default 30.';
