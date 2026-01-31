-- User feedback table for bug reports, suggestions, and questions
CREATE TABLE IF NOT EXISTS oh_user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES oh_admins(id),
  admin_email VARCHAR(255) NOT NULL,
  admin_name VARCHAR(255),
  category VARCHAR(20) NOT NULL, -- 'bug', 'suggestion', 'question'
  message TEXT NOT NULL,
  page_url VARCHAR(500), -- Which page they were on when submitting
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE oh_user_feedback ENABLE ROW LEVEL SECURITY;

-- Index for querying feedback by date
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON oh_user_feedback(created_at DESC);

COMMENT ON TABLE oh_user_feedback IS 'Stores user feedback, bug reports, and suggestions from team members';
COMMENT ON COLUMN oh_user_feedback.category IS 'Type of feedback: bug, suggestion, or question';
COMMENT ON COLUMN oh_user_feedback.page_url IS 'The admin page URL where feedback was submitted from';
