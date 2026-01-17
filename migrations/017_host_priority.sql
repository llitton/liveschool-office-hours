-- ============================================
-- MIGRATION 017: Host Priority for Round-Robin
-- ============================================
-- Adds priority-based assignment for round-robin events
-- Higher priority hosts get meetings first when available

-- Add priority column to event hosts (1-5 scale, 3 is default)
ALTER TABLE oh_event_hosts
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3
CHECK (priority >= 1 AND priority <= 5);

-- Add index for efficient priority-based queries
CREATE INDEX IF NOT EXISTS idx_event_hosts_priority
ON oh_event_hosts(event_id, priority DESC);

-- Add comment for documentation
COMMENT ON COLUMN oh_event_hosts.priority IS
'Host priority for round-robin assignment (1-5, higher = assigned first)';
