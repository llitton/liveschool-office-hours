-- Add toggle to disable automated post-session emails
-- When disabled, the cron job will skip sending follow-up, no-show, and feedback emails
-- This allows hosts to send these emails manually via the Wrap Up modal

ALTER TABLE oh_events
ADD COLUMN IF NOT EXISTS automated_emails_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN oh_events.automated_emails_enabled IS 'When false, disables automated follow-up, no-show, and feedback emails from the post-session cron. Host can still send manually.';
