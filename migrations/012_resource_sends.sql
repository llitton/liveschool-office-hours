-- Migration: Resource sends tracking table
-- This table tracks which resources have been manually sent to which bookings

CREATE TABLE IF NOT EXISTS oh_resource_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES oh_bookings(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES oh_prep_resources(id) ON DELETE CASCADE,
  sent_by TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_sends_booking ON oh_resource_sends(booking_id);
CREATE INDEX IF NOT EXISTS idx_resource_sends_resource ON oh_resource_sends(resource_id);
