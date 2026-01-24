-- Add feedback_topic_suggestion column for storing topic suggestions from feedback forms
-- This captures "What topics would you like to cover next time?" responses

ALTER TABLE oh_bookings
ADD COLUMN IF NOT EXISTS feedback_topic_suggestion TEXT DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN oh_bookings.feedback_topic_suggestion IS 'Topics suggested by attendee for future sessions';
