-- SMS Reminders Migration
-- Adds support for SMS text message reminders to attendees

-- SMS provider configuration (global)
CREATE TABLE oh_sms_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL DEFAULT 'aircall',
  api_key TEXT NOT NULL,
  api_secret TEXT,
  sender_phone VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add phone + SMS fields to bookings
ALTER TABLE oh_bookings ADD COLUMN phone VARCHAR(20);
ALTER TABLE oh_bookings ADD COLUMN sms_consent BOOLEAN DEFAULT false;
ALTER TABLE oh_bookings ADD COLUMN sms_reminder_24h_sent_at TIMESTAMPTZ;
ALTER TABLE oh_bookings ADD COLUMN sms_reminder_1h_sent_at TIMESTAMPTZ;

-- Add SMS settings to events
ALTER TABLE oh_events ADD COLUMN sms_reminders_enabled BOOLEAN DEFAULT false;
ALTER TABLE oh_events ADD COLUMN sms_phone_required BOOLEAN DEFAULT false;
ALTER TABLE oh_events ADD COLUMN sms_reminder_24h_template TEXT;
ALTER TABLE oh_events ADD COLUMN sms_reminder_1h_template TEXT;

-- Index for efficient SMS reminder queries
CREATE INDEX idx_bookings_sms_pending ON oh_bookings (sms_consent, phone)
  WHERE sms_consent = true AND phone IS NOT NULL;
