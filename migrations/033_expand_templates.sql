-- ============================================
-- MIGRATION 033: Expand Session Templates
-- ============================================
-- Add missing fields to templates so they capture a complete event configuration.
-- When applying a template, all event settings should be pre-populated.

ALTER TABLE oh_session_templates
ADD COLUMN IF NOT EXISTS subtitle TEXT,
ADD COLUMN IF NOT EXISTS banner_image TEXT,
ADD COLUMN IF NOT EXISTS no_show_subject TEXT,
ADD COLUMN IF NOT EXISTS no_show_body TEXT,
ADD COLUMN IF NOT EXISTS no_show_emails_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS no_show_email_delay_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS sms_reminder_24h_template TEXT,
ADD COLUMN IF NOT EXISTS sms_reminder_1h_template TEXT,
ADD COLUMN IF NOT EXISTS max_daily_bookings INTEGER,
ADD COLUMN IF NOT EXISTS max_weekly_bookings INTEGER,
ADD COLUMN IF NOT EXISTS ignore_busy_blocks BOOLEAN DEFAULT false;

-- Comments for documentation
COMMENT ON COLUMN oh_session_templates.subtitle IS 'Event subtitle displayed on booking page';
COMMENT ON COLUMN oh_session_templates.banner_image IS 'URL of banner image for booking page';
COMMENT ON COLUMN oh_session_templates.no_show_emails_enabled IS 'Whether to send no-show re-engagement emails';
COMMENT ON COLUMN oh_session_templates.ignore_busy_blocks IS 'Allow any time booking (skip calendar conflicts)';
