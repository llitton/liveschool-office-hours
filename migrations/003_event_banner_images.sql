-- Migration: Event Banner Images
-- Run this in your Supabase SQL editor

-- Add banner_image column to events for customizable public page banners
ALTER TABLE oh_events ADD COLUMN IF NOT EXISTS banner_image TEXT;

-- Comment explaining usage
COMMENT ON COLUMN oh_events.banner_image IS 'URL or path to the banner image for the public booking page. Can be a relative path like /banners/image.png or a full URL.';
