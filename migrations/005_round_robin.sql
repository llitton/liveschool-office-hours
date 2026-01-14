-- Round-Robin Booking Distribution
-- Automatically assign hosts to bookings for round-robin events

-- Round-robin configuration on events
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS round_robin_strategy TEXT
  CHECK (round_robin_strategy IN ('cycle', 'least_bookings', 'availability_weighted'))
  DEFAULT 'cycle';

ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS round_robin_period TEXT
  CHECK (round_robin_period IN ('day', 'week', 'month', 'all_time'))
  DEFAULT 'week';

-- Track assigned host on bookings (who was assigned to handle this booking)
ALTER TABLE oh_bookings ADD COLUMN IF NOT EXISTS assigned_host_id UUID REFERENCES oh_admins(id);
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_host ON oh_bookings(assigned_host_id);

-- Track cycle position for round-robin events
CREATE TABLE IF NOT EXISTS oh_round_robin_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES oh_events(id) ON DELETE CASCADE UNIQUE,
  last_assigned_host_id UUID REFERENCES oh_admins(id),
  last_assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assignment_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_round_robin_state_event ON oh_round_robin_state(event_id);
