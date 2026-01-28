-- Add email tracking columns to prevent duplicate automated emails
-- When manual follow-up is sent, these flags prevent the cron from sending duplicates

-- Track when follow-up email was sent (thank you / resources email to attendees)
ALTER TABLE oh_bookings
ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Track when no-show re-engagement email was sent
ALTER TABLE oh_bookings
ADD COLUMN IF NOT EXISTS no_show_email_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Track when feedback request email was sent
ALTER TABLE oh_bookings
ADD COLUMN IF NOT EXISTS feedback_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Add comments
COMMENT ON COLUMN oh_bookings.followup_sent_at IS 'When follow-up/thank you email was sent (manual or automated)';
COMMENT ON COLUMN oh_bookings.no_show_email_sent_at IS 'When no-show re-engagement email was sent (manual or automated)';
COMMENT ON COLUMN oh_bookings.feedback_sent_at IS 'When feedback request email was sent';
