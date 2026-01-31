-- Add separate webhook URL for user feedback notifications
ALTER TABLE oh_slack_config
ADD COLUMN IF NOT EXISTS feedback_webhook_url VARCHAR(500);

COMMENT ON COLUMN oh_slack_config.feedback_webhook_url IS 'Separate webhook URL for user feedback notifications (bugs, suggestions, questions). If not set, feedback notifications are skipped.';
