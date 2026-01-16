-- Add no-show re-engagement email templates to events
-- These emails are sent automatically to attendees marked as no-shows

-- Add no-show email template columns
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS no_show_subject TEXT;
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS no_show_body TEXT;

-- Add flag to enable/disable automatic no-show emails
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS no_show_emails_enabled BOOLEAN DEFAULT true;

-- Add delay setting (hours after session ends to send no-show email)
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS no_show_email_delay_hours INTEGER DEFAULT 2;

-- Comments
COMMENT ON COLUMN oh_events.no_show_subject IS 'Email subject for no-show re-engagement';
COMMENT ON COLUMN oh_events.no_show_body IS 'Email body template for no-show re-engagement. Supports variables like {{first_name}}, {{event_name}}, {{rebook_link}}';
COMMENT ON COLUMN oh_events.no_show_emails_enabled IS 'Whether to automatically send re-engagement emails to no-shows';
COMMENT ON COLUMN oh_events.no_show_email_delay_hours IS 'Hours after session ends to send no-show email (default 2)';
