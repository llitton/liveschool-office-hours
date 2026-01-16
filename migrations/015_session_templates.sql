-- Session Templates for quick event creation
-- Allows Hannah to quickly spin up common session types

CREATE TABLE IF NOT EXISTS oh_session_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📅',

  -- Event defaults
  meeting_type TEXT DEFAULT 'group',
  duration_minutes INTEGER DEFAULT 30,
  max_attendees INTEGER DEFAULT 10,

  -- Booking rules
  min_notice_hours INTEGER DEFAULT 24,
  booking_window_days INTEGER DEFAULT 30,

  -- Content
  custom_questions JSONB DEFAULT '[]',
  prep_materials TEXT,

  -- Metadata
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_session_templates_is_system ON oh_session_templates(is_system);

-- Seed system templates
INSERT INTO oh_session_templates (name, description, icon, meeting_type, duration_minutes, max_attendees, min_notice_hours, booking_window_days, is_system) VALUES
  ('Office Hours', 'Open Q&A session for educators to ask questions and get help', '🎯', 'group', 30, 15, 24, 30, true),
  ('Product Demo', 'Guided walkthrough of LiveSchool features and best practices', '🎬', 'group', 45, 25, 24, 60, true),
  ('1:1 Support', 'Private one-on-one support session for individual help', '💬', 'one_on_one', 30, 1, 24, 14, true),
  ('Training Workshop', 'Hands-on learning session for new features or workflows', '📚', 'group', 60, 20, 48, 30, true)
ON CONFLICT DO NOTHING;
