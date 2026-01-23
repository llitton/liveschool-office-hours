import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addHours, addDays, subHours, startOfDay } from 'date-fns';
import type { OHEvent, OHAdmin } from '@/types';

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: () => mockSupabaseClient,
}));

import {
  validateMinNotice,
  validateBookingWindow,
  validateDailyLimit,
  validateWeeklyLimit,
  validateAdminLimits,
  validateBookingConstraints,
  getEventConstraints,
  getConstraintSummary,
} from '@/lib/booking-constraints';

// ============================================
// HELPERS
// ============================================

function createCountQueryMock(count: number) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    then: (resolve: (val: { count: number; error: null }) => void) => {
      resolve({ count, error: null });
      return Promise.resolve({ count, error: null });
    },
  };
}

function createMockEvent(overrides: Partial<OHEvent> = {}): OHEvent {
  return {
    id: 'event-123',
    slug: 'test-event',
    name: 'Test Event',
    subtitle: null,
    description: null,
    duration_minutes: 30,
    host_name: 'Test Host',
    host_email: 'host@test.com',
    max_attendees: 1,
    buffer_before: 0,
    buffer_after: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    confirmation_subject: null,
    confirmation_body: null,
    reminder_subject: null,
    reminder_body: null,
    cancellation_subject: null,
    cancellation_body: null,
    no_show_subject: null,
    no_show_body: null,
    no_show_emails_enabled: false,
    no_show_email_delay_hours: 24,
    custom_questions: null,
    prep_materials: null,
    banner_image: null,
    meeting_type: 'one_on_one',
    allow_guests: false,
    guest_limit: 0,
    min_notice_hours: 24,
    max_daily_bookings: null,
    max_weekly_bookings: null,
    booking_window_days: 60,
    require_approval: false,
    ignore_busy_blocks: false,
    start_time_increment: 30,
    display_timezone: 'America/New_York',
    lock_timezone: false,
    round_robin_strategy: null,
    round_robin_period: 'week',
    sms_reminders_enabled: false,
    sms_phone_required: false,
    sms_reminder_24h_template: null,
    sms_reminder_1h_template: null,
    waitlist_enabled: false,
    waitlist_limit: null,
    is_one_off: false,
    single_use: false,
    one_off_expires_at: null,
    one_off_booked_at: null,
    ...overrides,
  };
}

function createMockAdmin(overrides: Partial<OHAdmin> = {}): OHAdmin {
  return {
    id: 'admin-123',
    email: 'admin@test.com',
    name: 'Test Admin',
    google_access_token: null,
    google_refresh_token: null,
    token_expires_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    max_meetings_per_day: 8,
    max_meetings_per_week: 30,
    default_buffer_before: 0,
    default_buffer_after: 0,
    profile_image: null,
    onboarding_progress: null,
    quick_links_token: 'test-quick-links-token',
    ...overrides,
  };
}

// ============================================
// TESTS
// ============================================

describe('Booking Constraints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateMinNotice (Priority 3: Booking rejects past slot)', () => {
    it('rejects booking less than min_notice_hours away', () => {
      // Slot is 12 hours from now, but min_notice is 24 hours
      const slotTime = addHours(new Date(), 12);
      const minNoticeHours = 24;

      const result = validateMinNotice(slotTime, minNoticeHours);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('requires 24 hours notice');
      expect(result.error).toContain('12 hours away');
    });

    it('accepts booking beyond min_notice_hours', () => {
      // Slot is 48 hours from now, min_notice is 24 hours
      const slotTime = addHours(new Date(), 48);
      const minNoticeHours = 24;

      const result = validateMinNotice(slotTime, minNoticeHours);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects booking that has already passed', () => {
      // Slot was 2 hours ago
      const slotTime = subHours(new Date(), 2);
      const minNoticeHours = 1;

      const result = validateMinNotice(slotTime, minNoticeHours);

      expect(result.valid).toBe(false);
    });

    it('accepts booking exactly at min_notice threshold', () => {
      // Slot is exactly 24 hours from now, min_notice is 24 hours
      const slotTime = addHours(new Date(), 24);
      const minNoticeHours = 24;

      const result = validateMinNotice(slotTime, minNoticeHours);

      expect(result.valid).toBe(true);
    });

    it('handles zero min_notice_hours', () => {
      // Slot is 1 hour from now, min_notice is 0
      const slotTime = addHours(new Date(), 1);
      const minNoticeHours = 0;

      const result = validateMinNotice(slotTime, minNoticeHours);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateBookingWindow', () => {
    it('rejects booking beyond booking window', () => {
      // Slot is 90 days from now, but window is 60 days
      const slotTime = addDays(new Date(), 90);
      const bookingWindowDays = 60;

      const result = validateBookingWindow(slotTime, bookingWindowDays);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('60 days in advance');
    });

    it('accepts booking within booking window', () => {
      // Slot is 30 days from now, window is 60 days
      const slotTime = addDays(new Date(), 30);
      const bookingWindowDays = 60;

      const result = validateBookingWindow(slotTime, bookingWindowDays);

      expect(result.valid).toBe(true);
    });

    it('accepts booking exactly at window boundary', () => {
      const slotTime = addDays(new Date(), 60);
      const bookingWindowDays = 60;

      const result = validateBookingWindow(slotTime, bookingWindowDays);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateDailyLimit', () => {
    it('rejects when daily limit reached', async () => {
      mockSupabaseClient.from.mockImplementation(() => createCountQueryMock(5));

      const slotTime = addDays(new Date(), 1);
      const result = await validateDailyLimit('event-123', slotTime, 5);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('daily booking limit of 5');
    });

    it('accepts when under daily limit', async () => {
      mockSupabaseClient.from.mockImplementation(() => createCountQueryMock(3));

      const slotTime = addDays(new Date(), 1);
      const result = await validateDailyLimit('event-123', slotTime, 5);

      expect(result.valid).toBe(true);
    });

    it('accepts when no daily limit is set', async () => {
      const slotTime = addDays(new Date(), 1);
      const result = await validateDailyLimit('event-123', slotTime, null);

      expect(result.valid).toBe(true);
      // Should not call database when limit is null
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  describe('validateWeeklyLimit', () => {
    it('rejects when weekly limit reached', async () => {
      mockSupabaseClient.from.mockImplementation(() => createCountQueryMock(10));

      const slotTime = addDays(new Date(), 1);
      const result = await validateWeeklyLimit('event-123', slotTime, 10);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('weekly booking limit of 10');
    });

    it('accepts when under weekly limit', async () => {
      mockSupabaseClient.from.mockImplementation(() => createCountQueryMock(5));

      const slotTime = addDays(new Date(), 1);
      const result = await validateWeeklyLimit('event-123', slotTime, 10);

      expect(result.valid).toBe(true);
    });

    it('accepts when no weekly limit is set', async () => {
      const slotTime = addDays(new Date(), 1);
      const result = await validateWeeklyLimit('event-123', slotTime, null);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateAdminLimits', () => {
    it('rejects when admin daily limit reached', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_slots') {
          return createCountQueryMock(8); // At daily limit
        }
        return createCountQueryMock(0);
      });

      const slotTime = addDays(new Date(), 1);
      const result = await validateAdminLimits('host@test.com', slotTime, 8, 30);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('daily meeting limit');
    });

    it('rejects when admin weekly limit reached', async () => {
      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        // First call is daily (under limit), second is weekly (at limit)
        return createCountQueryMock(callCount === 1 ? 5 : 30);
      });

      const slotTime = addDays(new Date(), 1);
      const result = await validateAdminLimits('host@test.com', slotTime, 8, 30);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('weekly meeting limit');
    });

    it('returns warning when approaching daily limit', async () => {
      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        // 7 daily meetings (one slot left), 20 weekly
        return createCountQueryMock(callCount === 1 ? 7 : 20);
      });

      const slotTime = addDays(new Date(), 1);
      const result = await validateAdminLimits('host@test.com', slotTime, 8, 30);

      expect(result.valid).toBe(true);
      expect(result.warning).toContain('last available slot for today');
    });

    it('returns warning when approaching weekly limit', async () => {
      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        // 5 daily meetings, 28 weekly (approaching limit)
        return createCountQueryMock(callCount === 1 ? 5 : 28);
      });

      const slotTime = addDays(new Date(), 1);
      const result = await validateAdminLimits('host@test.com', slotTime, 8, 30);

      expect(result.valid).toBe(true);
      expect(result.warning).toContain('approaching their weekly meeting limit');
    });
  });

  describe('validateBookingConstraints (Master validator)', () => {
    it('returns valid when all constraints pass', async () => {
      // Mock all count queries to return low numbers
      mockSupabaseClient.from.mockImplementation(() => createCountQueryMock(0));

      const event = createMockEvent({
        min_notice_hours: 1,
        booking_window_days: 60,
        max_daily_bookings: 10,
        max_weekly_bookings: 50,
      });

      const slotTime = addDays(new Date(), 2);
      const result = await validateBookingConstraints(event, slotTime);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('collects multiple errors when multiple constraints fail', async () => {
      mockSupabaseClient.from.mockImplementation(() => createCountQueryMock(10));

      const event = createMockEvent({
        min_notice_hours: 48, // Fails - slot is only 2 hours away
        booking_window_days: 1, // Fails - slot is 2 days away
        max_daily_bookings: 5, // Fails - already at 10
      });

      const slotTime = addHours(new Date(), 2);
      const result = await validateBookingConstraints(event, slotTime);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('adds approval warning when require_approval is true', async () => {
      mockSupabaseClient.from.mockImplementation(() => createCountQueryMock(0));

      const event = createMockEvent({
        min_notice_hours: 1,
        require_approval: true,
      });

      const slotTime = addDays(new Date(), 2);
      const result = await validateBookingConstraints(event, slotTime);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        'This booking will require approval from the host before confirmation.'
      );
    });

    it('handles string date input', async () => {
      mockSupabaseClient.from.mockImplementation(() => createCountQueryMock(0));

      const event = createMockEvent({ min_notice_hours: 1 });
      const slotTime = addDays(new Date(), 2).toISOString();

      const result = await validateBookingConstraints(event, slotTime);

      expect(result.valid).toBe(true);
    });

    it('uses admin limits when admin is provided', async () => {
      mockSupabaseClient.from.mockImplementation(() => createCountQueryMock(7));

      const event = createMockEvent({ min_notice_hours: 1 });
      const admin = createMockAdmin({ max_meetings_per_day: 8 });
      const slotTime = addDays(new Date(), 2);

      const result = await validateBookingConstraints(event, slotTime, admin);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('last available slot'))).toBe(true);
    });
  });

  describe('getEventConstraints', () => {
    it('returns event constraints with defaults', () => {
      const event = createMockEvent({
        min_notice_hours: 12,
        booking_window_days: 30,
        max_daily_bookings: 5,
        max_weekly_bookings: 20,
        require_approval: true,
      });

      const constraints = getEventConstraints(event);

      expect(constraints.minNoticeHours).toBe(12);
      expect(constraints.bookingWindowDays).toBe(30);
      expect(constraints.maxDailyBookings).toBe(5);
      expect(constraints.maxWeeklyBookings).toBe(20);
      expect(constraints.requireApproval).toBe(true);
      // Default admin limits
      expect(constraints.adminMaxDaily).toBe(8);
      expect(constraints.adminMaxWeekly).toBe(30);
    });

    it('uses admin limits when admin provided', () => {
      const event = createMockEvent();
      const admin = createMockAdmin({
        max_meetings_per_day: 4,
        max_meetings_per_week: 15,
      });

      const constraints = getEventConstraints(event, admin);

      expect(constraints.adminMaxDaily).toBe(4);
      expect(constraints.adminMaxWeekly).toBe(15);
    });
  });

  describe('getConstraintSummary', () => {
    it('generates human-readable summary for hours', () => {
      const summary = getConstraintSummary({
        minNoticeHours: 12,
        bookingWindowDays: 60,
        maxDailyBookings: null,
        maxWeeklyBookings: null,
        requireApproval: false,
        adminMaxDaily: 8,
        adminMaxWeekly: 30,
      });

      expect(summary).toContain('Book at least 12 hours in advance');
    });

    it('converts hours to days for 24+ hours', () => {
      const summary = getConstraintSummary({
        minNoticeHours: 48,
        bookingWindowDays: 60,
        maxDailyBookings: null,
        maxWeeklyBookings: null,
        requireApproval: false,
        adminMaxDaily: 8,
        adminMaxWeekly: 30,
      });

      expect(summary).toContain('Book at least 2 days in advance');
    });

    it('includes all constraint types', () => {
      const summary = getConstraintSummary({
        minNoticeHours: 24,
        bookingWindowDays: 14,
        maxDailyBookings: 3,
        maxWeeklyBookings: 10,
        requireApproval: true,
        adminMaxDaily: 8,
        adminMaxWeekly: 30,
      });

      expect(summary).toContain('Book at least 1 day in advance');
      expect(summary).toContain('Book up to 14 days ahead');
      expect(summary).toContain('Max 3 bookings per day');
      expect(summary).toContain('Max 10 bookings per week');
      expect(summary).toContain('Requires host approval');
    });

    it('handles singular vs plural correctly', () => {
      const summaryPlural = getConstraintSummary({
        minNoticeHours: 48,
        bookingWindowDays: 60,
        maxDailyBookings: 5,
        maxWeeklyBookings: null,
        requireApproval: false,
        adminMaxDaily: 8,
        adminMaxWeekly: 30,
      });
      // Function outputs "2 days in advance"
      expect(summaryPlural.some(s => s.includes('2 days'))).toBe(true);
      expect(summaryPlural.some(s => s.includes('5 booking'))).toBe(true);

      const summarySingular = getConstraintSummary({
        minNoticeHours: 24,
        bookingWindowDays: 60,
        maxDailyBookings: 1,
        maxWeeklyBookings: null,
        requireApproval: false,
        adminMaxDaily: 8,
        adminMaxWeekly: 30,
      });
      expect(summarySingular.some(s => s.includes('1 day'))).toBe(true);
      expect(summarySingular.some(s => s.includes('1 booking'))).toBe(true);
    });
  });
});
