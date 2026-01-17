-- Migration: Add phone_required field to events (independent of SMS reminders)
-- This allows requiring phone numbers for contact purposes without enabling SMS

-- Add phone_required column to oh_events
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS phone_required BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN oh_events.phone_required IS 'Require phone number on booking form (independent of SMS settings)';
