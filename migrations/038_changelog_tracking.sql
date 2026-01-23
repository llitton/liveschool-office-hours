-- Migration: Track when users last viewed the changelog
-- This enables showing a "new" badge when there are unseen updates

ALTER TABLE oh_admins
ADD COLUMN IF NOT EXISTS last_seen_changelog_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN oh_admins.last_seen_changelog_at IS 'When the user last viewed the What''s New changelog. NULL means never viewed.';
