-- Add invitation tracking columns to oh_admins
-- Enables tracking when invitations were sent and resend functionality

-- Track when the initial invitation was sent
ALTER TABLE oh_admins
ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Track when the most recent invitation was sent (for resends)
ALTER TABLE oh_admins
ADD COLUMN IF NOT EXISTS invitation_last_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN oh_admins.invitation_sent_at IS 'When the initial invitation email was sent';
COMMENT ON COLUMN oh_admins.invitation_last_sent_at IS 'When the most recent invitation email was sent (including resends)';
