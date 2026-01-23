-- ============================================
-- MIGRATION 034: Add CHECK Constraints for Data Integrity
-- ============================================
-- Add database-level validation to prevent invalid data that could
-- cause application errors or undefined behavior.

-- Slot time ordering: start_time must be before end_time
ALTER TABLE oh_slots
ADD CONSTRAINT check_slot_times
  CHECK (start_time < end_time);

-- Event duration must be positive and reasonable (max 8 hours = 480 minutes)
ALTER TABLE oh_events
ADD CONSTRAINT check_duration_range
  CHECK (duration_minutes > 0 AND duration_minutes <= 480);

-- Buffer times must be non-negative
ALTER TABLE oh_events
ADD CONSTRAINT check_buffer_before_non_negative
  CHECK (buffer_before IS NULL OR buffer_before >= 0);

ALTER TABLE oh_events
ADD CONSTRAINT check_buffer_after_non_negative
  CHECK (buffer_after IS NULL OR buffer_after >= 0);

-- Max attendees must be positive
ALTER TABLE oh_events
ADD CONSTRAINT check_max_attendees_positive
  CHECK (max_attendees > 0);

-- Min notice hours must be non-negative
ALTER TABLE oh_events
ADD CONSTRAINT check_min_notice_non_negative
  CHECK (min_notice_hours IS NULL OR min_notice_hours >= 0);

-- Booking window days must be positive
ALTER TABLE oh_events
ADD CONSTRAINT check_booking_window_positive
  CHECK (booking_window_days IS NULL OR booking_window_days > 0);

-- Start time increment must be positive (for scheduling grid)
ALTER TABLE oh_events
ADD CONSTRAINT check_start_time_increment_positive
  CHECK (start_time_increment IS NULL OR start_time_increment > 0);

-- Waitlist limit must be positive if set
ALTER TABLE oh_events
ADD CONSTRAINT check_waitlist_limit_positive
  CHECK (waitlist_limit IS NULL OR waitlist_limit > 0);

-- Guest limit must be non-negative
ALTER TABLE oh_events
ADD CONSTRAINT check_guest_limit_non_negative
  CHECK (guest_limit IS NULL OR guest_limit >= 0);

-- No-show email delay must be positive
ALTER TABLE oh_events
ADD CONSTRAINT check_no_show_delay_positive
  CHECK (no_show_email_delay_hours IS NULL OR no_show_email_delay_hours > 0);

-- Comments for documentation
COMMENT ON CONSTRAINT check_slot_times ON oh_slots IS 'Ensures slot start_time is before end_time';
COMMENT ON CONSTRAINT check_duration_range ON oh_events IS 'Event duration between 1-480 minutes (max 8 hours)';
COMMENT ON CONSTRAINT check_max_attendees_positive ON oh_events IS 'Prevents zero-capacity events';
