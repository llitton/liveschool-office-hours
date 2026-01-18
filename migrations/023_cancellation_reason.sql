-- Add cancellation reason field to bookings
-- This captures why someone cancelled their booking

ALTER TABLE oh_bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
