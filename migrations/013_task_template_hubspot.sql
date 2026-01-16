-- Add HubSpot sync option to task templates
-- When enabled, tasks created from this template will also be synced to HubSpot

ALTER TABLE oh_task_templates
ADD COLUMN IF NOT EXISTS sync_to_hubspot BOOLEAN DEFAULT false;

COMMENT ON COLUMN oh_task_templates.sync_to_hubspot IS 'If true, tasks created from this template will be synced to HubSpot';
