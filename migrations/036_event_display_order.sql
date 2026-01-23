-- ============================================
-- MIGRATION 036: Event Display Order
-- ============================================
-- Add display_order column for drag-and-drop reordering of events

-- Add display_order column with default based on creation order
ALTER TABLE oh_events
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Set initial display_order values based on creation timestamp (newest first)
WITH ordered_events AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
  FROM oh_events
)
UPDATE oh_events e
SET display_order = oe.rn
FROM ordered_events oe
WHERE e.id = oe.id
AND e.display_order IS NULL;

-- Set default for new events (will be at the top)
ALTER TABLE oh_events
ALTER COLUMN display_order SET DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_oh_events_display_order
ON oh_events (display_order ASC NULLS LAST);

COMMENT ON COLUMN oh_events.display_order IS
  'Custom display order for events on the dashboard. Lower numbers appear first. Set via drag-and-drop reordering.';
