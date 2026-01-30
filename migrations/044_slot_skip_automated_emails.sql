-- Migration 044: Add skip_automated_emails to oh_slots
-- Allows disabling automated emails for specific sessions without affecting the entire event

ALTER TABLE oh_slots
ADD COLUMN IF NOT EXISTS skip_automated_emails BOOLEAN DEFAULT FALSE;

-- Add comment explaining the column
COMMENT ON COLUMN oh_slots.skip_automated_emails IS 'When true, skip all automated post-session emails (follow-up, no-show, feedback) for this specific slot';
