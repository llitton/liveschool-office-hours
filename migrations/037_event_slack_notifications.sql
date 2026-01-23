-- Migration: Add per-event Slack notification toggle
-- This allows admins to enable/disable Slack notifications for specific events

-- Add slack_notifications_enabled column to oh_events
ALTER TABLE oh_events
ADD COLUMN IF NOT EXISTS slack_notifications_enabled BOOLEAN DEFAULT false;

-- Add to session templates as well
ALTER TABLE oh_session_templates
ADD COLUMN IF NOT EXISTS slack_notifications_enabled BOOLEAN DEFAULT false;

-- Update existing LiveSchool Office Hours event to have notifications enabled
-- (You can adjust this based on which events should have notifications)
UPDATE oh_events
SET slack_notifications_enabled = true
WHERE slug = 'liveschool-office-hours';

COMMENT ON COLUMN oh_events.slack_notifications_enabled IS 'When true, new bookings for this event will trigger Slack notifications';
