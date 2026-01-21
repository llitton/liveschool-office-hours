-- Add 'priority' to the allowed round-robin strategies
-- This enables priority-based assignment where higher-priority hosts get meetings first

-- Drop the existing constraint
ALTER TABLE oh_events DROP CONSTRAINT IF EXISTS oh_events_round_robin_strategy_check;

-- Add updated constraint including 'priority'
ALTER TABLE oh_events ADD CONSTRAINT oh_events_round_robin_strategy_check
  CHECK (round_robin_strategy IN ('cycle', 'least_bookings', 'availability_weighted', 'priority'));

-- Add comment for clarity
COMMENT ON COLUMN oh_events.round_robin_strategy IS
'Distribution strategy for round-robin events: cycle (rotation), least_bookings (load balanced), availability_weighted, or priority (highest priority host first)';
