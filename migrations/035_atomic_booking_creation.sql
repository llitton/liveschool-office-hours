-- ============================================
-- MIGRATION 035: Atomic Booking Creation
-- ============================================
-- Prevent race conditions in booking creation through:
-- 1. Unique constraint to prevent duplicate bookings
-- 2. Stored procedure with row locking for atomic capacity checks
-- 3. Automatic waitlist position assignment

-- ============================================
-- PART 1: Unique Constraint for Duplicate Prevention
-- ============================================
-- Prevent the same email from booking the same slot twice
-- Only applies to non-cancelled bookings
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_booking_per_slot_email
ON oh_bookings (slot_id, lower(email))
WHERE cancelled_at IS NULL;

COMMENT ON INDEX idx_unique_booking_per_slot_email IS
  'Prevents duplicate bookings: same email cannot book the same slot twice (unless cancelled)';

-- ============================================
-- PART 2: Atomic Booking Creation Function
-- ============================================
-- This function handles booking creation with proper locking to prevent race conditions
-- It returns a JSON object with either the booking data or an error

CREATE OR REPLACE FUNCTION create_booking_atomic(
  p_slot_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_manage_token TEXT,
  p_question_responses JSONB DEFAULT '{}'::jsonb,
  p_attendee_timezone TEXT DEFAULT NULL,
  p_assigned_host_id UUID DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_sms_consent BOOLEAN DEFAULT false,
  p_guest_emails TEXT[] DEFAULT '{}'::text[]
) RETURNS JSONB AS $$
DECLARE
  v_slot RECORD;
  v_event RECORD;
  v_confirmed_count INTEGER;
  v_waitlist_count INTEGER;
  v_is_waitlisted BOOLEAN := false;
  v_waitlist_position INTEGER := NULL;
  v_booking_id UUID;
  v_result JSONB;
BEGIN
  -- Lock the slot row to prevent concurrent modifications
  -- This ensures only one booking can be processed at a time for this slot
  SELECT s.*, e.max_attendees, e.waitlist_enabled, e.waitlist_limit
  INTO v_slot
  FROM oh_slots s
  JOIN oh_events e ON s.event_id = e.id
  WHERE s.id = p_slot_id
  FOR UPDATE OF s;  -- Lock only the slot row

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Slot not found',
      'error_code', 'SLOT_NOT_FOUND'
    );
  END IF;

  IF v_slot.is_cancelled THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This time slot is no longer available',
      'error_code', 'SLOT_CANCELLED'
    );
  END IF;

  -- Check if user already has a booking for this slot
  IF EXISTS (
    SELECT 1 FROM oh_bookings
    WHERE slot_id = p_slot_id
    AND lower(email) = lower(p_email)
    AND cancelled_at IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You have already booked this time slot',
      'error_code', 'DUPLICATE_BOOKING'
    );
  END IF;

  -- Count confirmed (non-waitlisted) bookings
  SELECT COUNT(*) INTO v_confirmed_count
  FROM oh_bookings
  WHERE slot_id = p_slot_id
  AND cancelled_at IS NULL
  AND is_waitlisted = false;

  -- Check if slot is full
  IF v_confirmed_count >= v_slot.max_attendees THEN
    -- Check if waitlist is enabled
    IF NOT v_slot.waitlist_enabled THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This time slot is full',
        'error_code', 'SLOT_FULL'
      );
    END IF;

    -- Count current waitlist
    SELECT COUNT(*) INTO v_waitlist_count
    FROM oh_bookings
    WHERE slot_id = p_slot_id
    AND cancelled_at IS NULL
    AND is_waitlisted = true;

    -- Check waitlist limit
    IF v_slot.waitlist_limit IS NOT NULL AND v_waitlist_count >= v_slot.waitlist_limit THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This time slot and its waitlist are both full',
        'error_code', 'WAITLIST_FULL'
      );
    END IF;

    -- Add to waitlist
    v_is_waitlisted := true;
    v_waitlist_position := v_waitlist_count + 1;
  END IF;

  -- Create the booking
  INSERT INTO oh_bookings (
    slot_id,
    first_name,
    last_name,
    email,
    manage_token,
    question_responses,
    attendee_timezone,
    assigned_host_id,
    phone,
    sms_consent,
    is_waitlisted,
    waitlist_position,
    guest_emails
  ) VALUES (
    p_slot_id,
    p_first_name,
    p_last_name,
    lower(p_email),
    p_manage_token,
    p_question_responses,
    p_attendee_timezone,
    p_assigned_host_id,
    p_phone,
    p_sms_consent,
    v_is_waitlisted,
    v_waitlist_position,
    p_guest_emails
  )
  RETURNING id INTO v_booking_id;

  -- Return the booking data
  SELECT jsonb_build_object(
    'success', true,
    'booking_id', b.id,
    'is_waitlisted', b.is_waitlisted,
    'waitlist_position', b.waitlist_position,
    'created_at', b.created_at
  ) INTO v_result
  FROM oh_bookings b
  WHERE b.id = v_booking_id;

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition where unique constraint is violated
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You have already booked this time slot',
      'error_code', 'DUPLICATE_BOOKING'
    );
  WHEN OTHERS THEN
    -- Log and return generic error
    RAISE WARNING 'create_booking_atomic error: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unable to create booking. Please try again.',
      'error_code', 'UNKNOWN_ERROR',
      'details', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_booking_atomic IS
  'Atomically creates a booking with proper locking to prevent race conditions. '
  'Handles capacity checks, waitlist, and duplicate prevention in a single transaction.';

-- ============================================
-- PART 3: Grant execute permission
-- ============================================
-- Allow the service role to execute the function
GRANT EXECUTE ON FUNCTION create_booking_atomic TO service_role;
