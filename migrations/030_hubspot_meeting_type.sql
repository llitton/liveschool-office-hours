-- Add HubSpot meeting type field to oh_events
-- This allows mapping events to specific HubSpot meeting types (hs_activity_type)
-- so that bookings are logged to HubSpot with the correct meeting type classification

-- Add the hubspot_meeting_type column
ALTER TABLE oh_events
ADD COLUMN IF NOT EXISTS hubspot_meeting_type TEXT;

-- Add comment for clarity
COMMENT ON COLUMN oh_events.hubspot_meeting_type IS
'The HubSpot meeting type (hs_activity_type value) to use when logging meetings from this event to HubSpot. e.g., "first_demo", "discovery_call". NULL means no specific type will be set.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_oh_events_hubspot_meeting_type
ON oh_events(hubspot_meeting_type)
WHERE hubspot_meeting_type IS NOT NULL;
