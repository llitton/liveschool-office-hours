-- Expand event templates with additional fields for complete event configuration
-- Migration: 027_event_templates_expand.sql

-- Buffer times
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS buffer_before integer DEFAULT 15;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS buffer_after integer DEFAULT 15;

-- Scheduling settings
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS start_time_increment integer DEFAULT 30;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS require_approval boolean DEFAULT false;

-- Timezone settings
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS display_timezone text;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS lock_timezone boolean DEFAULT false;

-- Guest settings
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS allow_guests boolean DEFAULT false;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS guest_limit integer DEFAULT 0;

-- Email templates
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS confirmation_subject text;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS confirmation_body text;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS reminder_subject text;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS reminder_body text;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS cancellation_subject text;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS cancellation_body text;

-- Waitlist settings
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS waitlist_enabled boolean DEFAULT false;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS waitlist_limit integer;

-- SMS settings
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS sms_reminders_enabled boolean DEFAULT false;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS sms_phone_required boolean DEFAULT false;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS phone_required boolean DEFAULT false;

-- Round-robin settings
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS round_robin_strategy text;
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS round_robin_period text;

-- Template ownership (null = system template, admin_id = user template)
ALTER TABLE oh_session_templates ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES oh_admins(id) ON DELETE SET NULL;

-- Add index for user templates
CREATE INDEX IF NOT EXISTS idx_session_templates_created_by ON oh_session_templates(created_by);
