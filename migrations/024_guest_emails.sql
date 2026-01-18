-- Add guest_emails field to bookings
-- Stores array of email addresses for additional attendees

ALTER TABLE oh_bookings ADD COLUMN IF NOT EXISTS guest_emails TEXT[] DEFAULT '{}';
