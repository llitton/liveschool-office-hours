-- ============================================
-- MIGRATION 021: Quick Links Personal Token
-- ============================================
-- Allow hosts to access their booking links via a personal token URL
-- without needing to be logged into the admin dashboard

-- Add quick_links_token field to admins
ALTER TABLE oh_admins
ADD COLUMN IF NOT EXISTS quick_links_token VARCHAR(32) UNIQUE;

-- Generate tokens for existing admins
UPDATE oh_admins
SET quick_links_token = substr(md5(random()::text || id::text), 1, 24)
WHERE quick_links_token IS NULL;

-- Make it NOT NULL after populating
ALTER TABLE oh_admins
ALTER COLUMN quick_links_token SET NOT NULL;

-- Add default for new admins
ALTER TABLE oh_admins
ALTER COLUMN quick_links_token SET DEFAULT substr(md5(random()::text), 1, 24);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_admins_quick_links_token ON oh_admins(quick_links_token);

-- Comment for documentation
COMMENT ON COLUMN oh_admins.quick_links_token IS
'Personal token for accessing booking links without login. Used at /my-links/[token]';
