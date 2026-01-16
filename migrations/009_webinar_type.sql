-- Add webinar meeting type
-- Webinars are presentation-style events where min_notice doesn't apply

-- Drop the existing constraint
ALTER TABLE oh_events DROP CONSTRAINT IF EXISTS oh_events_meeting_type_check;

-- Add the updated constraint with webinar type
ALTER TABLE oh_events ADD CONSTRAINT oh_events_meeting_type_check
CHECK (meeting_type IN ('one_on_one', 'group', 'collective', 'round_robin', 'panel', 'webinar'));

-- Update comment
COMMENT ON COLUMN oh_events.meeting_type IS 'Type: one_on_one, group, collective, round_robin, panel, webinar';
