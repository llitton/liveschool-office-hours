-- ============================================
-- MIGRATION 019: Meeting Polls
-- ============================================
-- Doodle-style voting for finding the best meeting time

-- Main polls table
CREATE TABLE IF NOT EXISTS oh_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  host_id UUID NOT NULL REFERENCES oh_admins(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location VARCHAR(255), -- e.g., "Google Meet", "Zoom", or custom location

  -- Settings
  show_votes BOOLEAN DEFAULT false, -- If true, participants can see who voted for what
  max_votes_per_person INTEGER, -- NULL = unlimited, or limit votes per participant

  -- Status tracking
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'booked')),
  closed_at TIMESTAMPTZ,

  -- When poll is booked, reference the created event/slot
  booked_event_id UUID REFERENCES oh_events(id) ON DELETE SET NULL,
  booked_slot_id UUID REFERENCES oh_slots(id) ON DELETE SET NULL,
  booked_at TIMESTAMPTZ,
  booked_option_id UUID, -- Which option was selected for booking

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poll time options (the times people vote on)
CREATE TABLE IF NOT EXISTS oh_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES oh_polls(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  sort_order INTEGER DEFAULT 0,

  -- Cached vote count for quick display
  vote_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Votes from participants
CREATE TABLE IF NOT EXISTS oh_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES oh_polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES oh_poll_options(id) ON DELETE CASCADE,

  -- Voter info (no auth required)
  voter_name VARCHAR(255) NOT NULL,
  voter_email VARCHAR(255) NOT NULL,

  -- Vote type: 'yes' = available, 'maybe' = if needed, 'no' = not available
  -- For simplicity, we'll just track positive votes (yes/maybe)
  vote_type VARCHAR(20) DEFAULT 'yes' CHECK (vote_type IN ('yes', 'maybe')),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each person can only vote once per option
  UNIQUE(option_id, voter_email)
);

-- Invitees added when booking (people who didn't vote but should be invited)
CREATE TABLE IF NOT EXISTS oh_poll_invitees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES oh_polls(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(poll_id, email)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_polls_host ON oh_polls(host_id);
CREATE INDEX IF NOT EXISTS idx_polls_status ON oh_polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_slug ON oh_polls(slug);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON oh_poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON oh_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON oh_poll_votes(option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_email ON oh_poll_votes(voter_email);

-- Trigger to update vote_count on oh_poll_options
CREATE OR REPLACE FUNCTION update_poll_option_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE oh_poll_options
    SET vote_count = vote_count + 1
    WHERE id = NEW.option_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE oh_poll_options
    SET vote_count = vote_count - 1
    WHERE id = OLD.option_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS poll_vote_count_trigger ON oh_poll_votes;
CREATE TRIGGER poll_vote_count_trigger
AFTER INSERT OR DELETE ON oh_poll_votes
FOR EACH ROW EXECUTE FUNCTION update_poll_option_vote_count();

-- Trigger to auto-close polls when all options have passed
CREATE OR REPLACE FUNCTION auto_close_expired_polls()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if all options for this poll have passed
  IF NOT EXISTS (
    SELECT 1 FROM oh_poll_options
    WHERE poll_id = NEW.poll_id
    AND end_time > NOW()
  ) THEN
    UPDATE oh_polls
    SET status = 'closed', closed_at = NOW(), updated_at = NOW()
    WHERE id = NEW.poll_id AND status = 'open';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE oh_polls IS 'Meeting polls for voting-based scheduling';
COMMENT ON TABLE oh_poll_options IS 'Time slot options that participants vote on';
COMMENT ON TABLE oh_poll_votes IS 'Individual votes from participants';
COMMENT ON TABLE oh_poll_invitees IS 'Additional invitees added when booking the meeting';
COMMENT ON COLUMN oh_polls.show_votes IS 'If true, participants can see who voted for each option';
COMMENT ON COLUMN oh_poll_votes.vote_type IS 'yes = definitely available, maybe = available if needed';
