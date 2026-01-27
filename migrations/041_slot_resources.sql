-- Add deck link and shared links to slots for post-session resources
-- Migration: 041_slot_resources.sql

-- Add deck_link column for presentation/slides link
ALTER TABLE oh_slots
ADD COLUMN IF NOT EXISTS deck_link TEXT;

-- Add shared_links column for array of resource links shared during session
-- Stored as JSONB array of objects: [{ "title": "Resource Name", "url": "https://..." }]
ALTER TABLE oh_slots
ADD COLUMN IF NOT EXISTS shared_links JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN oh_slots.deck_link IS 'Link to presentation/deck used during the session';
COMMENT ON COLUMN oh_slots.shared_links IS 'JSON array of resource links shared during session: [{"title": "...", "url": "..."}]';
