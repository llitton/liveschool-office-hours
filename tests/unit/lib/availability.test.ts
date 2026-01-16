import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDays, addHours, setHours, setMinutes, startOfDay } from 'date-fns';

// Mock Supabase before importing the module under test
const mockSupabaseClient = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: () => mockSupabaseClient,
}));

vi.mock('@/lib/google', () => ({
  getFreeBusy: vi.fn().mockResolvedValue([]),
}));

import {
  checkTimeAvailability,
  getAvailableSlots,
  getAvailabilityPatterns,
  getBusyBlocks,
} from '@/lib/availability';

// ============================================
// HELPERS
// ============================================

function createQueryMock(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] || null, error: null }),
    then: (resolve: (val: { data: unknown[]; error: null }) => void) => {
      resolve({ data, error: null });
      return Promise.resolve({ data, error: null });
    },
  };
}

function getTomorrowAt(hour: number, minute: number = 0): Date {
  const tomorrow = addDays(new Date(), 1);
  return setMinutes(setHours(startOfDay(tomorrow), hour), minute);
}

function getNextWeekdayAt(dayOfWeek: number, hour: number, minute: number = 0): Date {
  const now = new Date();
  const currentDay = now.getDay();
  let daysToAdd = dayOfWeek - currentDay;
  if (daysToAdd <= 0) daysToAdd += 7;

  const targetDate = addDays(now, daysToAdd);
  return setMinutes(setHours(startOfDay(targetDate), hour), minute);
}

// ============================================
// TESTS
// ============================================

describe('Availability Logic', () => {
  const testAdminId = 'admin-123';
  const testEventId = 'event-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkTimeAvailability', () => {
    it('returns available when no conflicts exist', async () => {
      // Mock: no patterns (allows any time), no busy blocks, no existing slots
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([]); // No patterns = allows any time
        }
        if (table === 'oh_busy_blocks') {
          return createQueryMock([]);
        }
        if (table === 'oh_slots') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const start = getTomorrowAt(14, 0); // 2pm tomorrow
      const end = getTomorrowAt(14, 30); // 2:30pm

      const result = await checkTimeAvailability(testAdminId, start, end);

      expect(result.available).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns unavailable when outside availability hours', async () => {
      const tuesday = getNextWeekdayAt(2, 8, 0); // Tuesday 8am (outside 9-5)
      const tuesdayEnd = getNextWeekdayAt(2, 8, 30);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([
            {
              id: 'pattern-1',
              admin_id: testAdminId,
              day_of_week: 2, // Tuesday
              start_time: '09:00:00', // 9am
              end_time: '17:00:00', // 5pm
              timezone: 'America/New_York',
              is_active: true,
            },
          ]);
        }
        if (table === 'oh_busy_blocks') {
          return createQueryMock([]);
        }
        if (table === 'oh_slots') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const result = await checkTimeAvailability(testAdminId, tuesday, tuesdayEnd);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Outside of set availability hours');
    });

    it('returns available when within availability hours', async () => {
      const tuesday = getNextWeekdayAt(2, 14, 0); // Tuesday 2pm
      const tuesdayEnd = getNextWeekdayAt(2, 14, 30);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([
            {
              id: 'pattern-1',
              admin_id: testAdminId,
              day_of_week: 2, // Tuesday
              start_time: '09:00:00',
              end_time: '17:00:00',
              timezone: 'America/New_York',
              is_active: true,
            },
          ]);
        }
        if (table === 'oh_busy_blocks') {
          return createQueryMock([]);
        }
        if (table === 'oh_slots') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const result = await checkTimeAvailability(testAdminId, tuesday, tuesdayEnd);

      expect(result.available).toBe(true);
    });

    it('returns unavailable when conflicts with busy block', async () => {
      const tomorrow2pm = getTomorrowAt(14, 0);
      const tomorrow230pm = getTomorrowAt(14, 30);

      // Busy block from 1:30pm to 3pm
      const busyStart = getTomorrowAt(13, 30);
      const busyEnd = getTomorrowAt(15, 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([]); // No patterns
        }
        if (table === 'oh_busy_blocks') {
          return createQueryMock([
            {
              id: 'busy-1',
              admin_id: testAdminId,
              start_time: busyStart.toISOString(),
              end_time: busyEnd.toISOString(),
              source: 'google_calendar',
            },
          ]);
        }
        if (table === 'oh_slots') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const result = await checkTimeAvailability(testAdminId, tomorrow2pm, tomorrow230pm);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Conflicts with calendar event');
    });

    it('returns unavailable when conflicts with existing slot', async () => {
      const tomorrow2pm = getTomorrowAt(14, 0);
      const tomorrow230pm = getTomorrowAt(14, 30);

      // Existing slot from 2pm to 2:30pm
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([]);
        }
        if (table === 'oh_busy_blocks') {
          return createQueryMock([]);
        }
        if (table === 'oh_slots') {
          return createQueryMock([
            {
              start_time: tomorrow2pm.toISOString(),
              end_time: tomorrow230pm.toISOString(),
              event: { host_email: 'test@test.com' },
            },
          ]);
        }
        return createQueryMock([]);
      });

      const result = await checkTimeAvailability(testAdminId, tomorrow2pm, tomorrow230pm);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Conflicts with existing slot');
    });

    it('respects buffer times when checking conflicts', async () => {
      const tomorrow2pm = getTomorrowAt(14, 0);
      const tomorrow230pm = getTomorrowAt(14, 30);

      // Existing slot from 2:30pm to 3pm (adjacent, but with 15min buffer should conflict)
      const existingStart = getTomorrowAt(14, 30);
      const existingEnd = getTomorrowAt(15, 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([]);
        }
        if (table === 'oh_busy_blocks') {
          return createQueryMock([]);
        }
        if (table === 'oh_slots') {
          return createQueryMock([
            {
              start_time: existingStart.toISOString(),
              end_time: existingEnd.toISOString(),
              event: { host_email: 'test@test.com' },
            },
          ]);
        }
        return createQueryMock([]);
      });

      // Without buffer - should not conflict (slots are adjacent)
      const resultNoBuffer = await checkTimeAvailability(
        testAdminId,
        tomorrow2pm,
        tomorrow230pm,
        undefined,
        0, // no buffer before
        0  // no buffer after
      );
      expect(resultNoBuffer.available).toBe(true);

      // With 15min buffer after - should conflict
      const resultWithBuffer = await checkTimeAvailability(
        testAdminId,
        tomorrow2pm,
        tomorrow230pm,
        undefined,
        0,  // no buffer before
        15  // 15min buffer after
      );
      expect(resultWithBuffer.available).toBe(false);
    });
  });

  describe('getAvailableSlots', () => {
    it('generates slots within working hours based on patterns', async () => {
      // Pattern: Tuesday 2pm-4pm, 30min duration
      const tuesday = getNextWeekdayAt(2, 0, 0);
      const tuesdayEnd = addDays(tuesday, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([
            {
              id: 'pattern-1',
              admin_id: testAdminId,
              day_of_week: 2, // Tuesday
              start_time: '14:00:00', // 2pm
              end_time: '16:00:00',   // 4pm
              timezone: 'America/New_York',
              is_active: true,
            },
          ]);
        }
        if (table === 'oh_busy_blocks') {
          return createQueryMock([]);
        }
        if (table === 'oh_slots') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const slots = await getAvailableSlots(
        testAdminId,
        30, // 30min duration
        0,  // no buffer before
        0,  // no buffer after
        tuesday,
        tuesdayEnd
      );

      // Should generate 4 slots: 2:00, 2:30, 3:00, 3:30
      expect(slots.length).toBe(4);

      // Verify slot times
      const slotHours = slots.map(s => s.start.getHours());
      const slotMinutes = slots.map(s => s.start.getMinutes());

      expect(slotHours).toContain(14);
      expect(slotMinutes).toContain(0);
      expect(slotMinutes).toContain(30);
    });

    it('excludes slots that conflict with existing bookings', async () => {
      const tuesday = getNextWeekdayAt(2, 0, 0);
      const tuesdayEnd = addDays(tuesday, 1);

      // Existing booking at 2:30pm
      const existingStart = getNextWeekdayAt(2, 14, 30);
      const existingEnd = getNextWeekdayAt(2, 15, 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([
            {
              id: 'pattern-1',
              admin_id: testAdminId,
              day_of_week: 2, // Tuesday
              start_time: '14:00:00', // 2pm
              end_time: '16:00:00',   // 4pm
              timezone: 'America/New_York',
              is_active: true,
            },
          ]);
        }
        if (table === 'oh_busy_blocks') {
          return createQueryMock([]);
        }
        if (table === 'oh_slots') {
          return createQueryMock([
            {
              start_time: existingStart.toISOString(),
              end_time: existingEnd.toISOString(),
              event: { host_email: 'test@test.com' },
            },
          ]);
        }
        return createQueryMock([]);
      });

      const slots = await getAvailableSlots(
        testAdminId,
        30, // 30min duration
        0,  // no buffer
        0,
        tuesday,
        tuesdayEnd
      );

      // Should generate 3 slots: 2:00, 3:00, 3:30 (excluding 2:30 which is booked)
      expect(slots.length).toBe(3);

      // Verify 2:30 is NOT in the available slots
      const has230 = slots.some(s =>
        s.start.getHours() === 14 && s.start.getMinutes() === 30
      );
      expect(has230).toBe(false);
    });

    it('excludes slots that conflict with busy blocks', async () => {
      const tuesday = getNextWeekdayAt(2, 0, 0);
      const tuesdayEnd = addDays(tuesday, 1);

      // Busy block from 2:45pm to 3:15pm (conflicts with 3:00 slot)
      const busyStart = getNextWeekdayAt(2, 14, 45);
      const busyEnd = getNextWeekdayAt(2, 15, 15);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([
            {
              id: 'pattern-1',
              admin_id: testAdminId,
              day_of_week: 2,
              start_time: '14:00:00',
              end_time: '16:00:00',
              timezone: 'America/New_York',
              is_active: true,
            },
          ]);
        }
        if (table === 'oh_busy_blocks') {
          return createQueryMock([
            {
              id: 'busy-1',
              admin_id: testAdminId,
              start_time: busyStart.toISOString(),
              end_time: busyEnd.toISOString(),
              source: 'google_calendar',
            },
          ]);
        }
        if (table === 'oh_slots') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const slots = await getAvailableSlots(
        testAdminId,
        30,
        0,
        0,
        tuesday,
        tuesdayEnd
      );

      // 3:00 slot should be excluded due to busy block
      const has300 = slots.some(s =>
        s.start.getHours() === 15 && s.start.getMinutes() === 0
      );
      expect(has300).toBe(false);
    });

    it('respects buffer times between slots', async () => {
      const tuesday = getNextWeekdayAt(2, 0, 0);
      const tuesdayEnd = addDays(tuesday, 1);

      // Existing slot at 2:30pm-3pm
      const existingStart = getNextWeekdayAt(2, 14, 30);
      const existingEnd = getNextWeekdayAt(2, 15, 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([
            {
              id: 'pattern-1',
              admin_id: testAdminId,
              day_of_week: 2,
              start_time: '14:00:00',
              end_time: '16:00:00',
              timezone: 'America/New_York',
              is_active: true,
            },
          ]);
        }
        if (table === 'oh_busy_blocks') {
          return createQueryMock([]);
        }
        if (table === 'oh_slots') {
          return createQueryMock([
            {
              start_time: existingStart.toISOString(),
              end_time: existingEnd.toISOString(),
              event: { host_email: 'test@test.com' },
            },
          ]);
        }
        return createQueryMock([]);
      });

      // With 15min buffer before, the 2:00 slot should conflict
      // (needs 15min buffer before the 2:30 existing slot)
      const slotsWithBuffer = await getAvailableSlots(
        testAdminId,
        30,
        15, // 15min buffer before
        15, // 15min buffer after
        tuesday,
        tuesdayEnd
      );

      // With buffers: 2:00 conflicts (too close to 2:30), 2:30 is booked, 3:00 conflicts
      // Only 3:30 should remain
      const has200 = slotsWithBuffer.some(s =>
        s.start.getHours() === 14 && s.start.getMinutes() === 0
      );
      const has300 = slotsWithBuffer.some(s =>
        s.start.getHours() === 15 && s.start.getMinutes() === 0
      );

      expect(has200).toBe(false);
      expect(has300).toBe(false);
    });

    it('generates no slots when no availability patterns exist', async () => {
      const tomorrow = addDays(new Date(), 1);
      const dayAfter = addDays(tomorrow, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([]); // No patterns
        }
        if (table === 'oh_busy_blocks') {
          return createQueryMock([]);
        }
        if (table === 'oh_slots') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const slots = await getAvailableSlots(
        testAdminId,
        30,
        0,
        0,
        tomorrow,
        dayAfter
      );

      expect(slots.length).toBe(0);
    });

    it('handles multiple availability patterns on the same day', async () => {
      const tuesday = getNextWeekdayAt(2, 0, 0);
      const tuesdayEnd = addDays(tuesday, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([
            {
              id: 'pattern-1',
              admin_id: testAdminId,
              day_of_week: 2,
              start_time: '09:00:00', // 9am-10am
              end_time: '10:00:00',
              timezone: 'America/New_York',
              is_active: true,
            },
            {
              id: 'pattern-2',
              admin_id: testAdminId,
              day_of_week: 2,
              start_time: '14:00:00', // 2pm-3pm
              end_time: '15:00:00',
              timezone: 'America/New_York',
              is_active: true,
            },
          ]);
        }
        if (table === 'oh_busy_blocks') {
          return createQueryMock([]);
        }
        if (table === 'oh_slots') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const slots = await getAvailableSlots(
        testAdminId,
        30,
        0,
        0,
        tuesday,
        tuesdayEnd
      );

      // Should have slots from both patterns
      const morningSlots = slots.filter(s => s.start.getHours() < 12);
      const afternoonSlots = slots.filter(s => s.start.getHours() >= 12);

      expect(morningSlots.length).toBeGreaterThan(0);
      expect(afternoonSlots.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailabilityPatterns', () => {
    it('returns patterns for admin', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_availability_patterns') {
          return createQueryMock([
            {
              id: 'pattern-1',
              admin_id: testAdminId,
              day_of_week: 1,
              start_time: '09:00:00',
              end_time: '17:00:00',
              timezone: 'America/New_York',
              is_active: true,
            },
          ]);
        }
        return createQueryMock([]);
      });

      const patterns = await getAvailabilityPatterns(testAdminId);

      expect(patterns.length).toBe(1);
      expect(patterns[0].day_of_week).toBe(1);
    });
  });

  describe('getBusyBlocks', () => {
    it('returns busy blocks for admin within date range', async () => {
      const tomorrow = addDays(new Date(), 1);
      const dayAfter = addDays(tomorrow, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'oh_busy_blocks') {
          return createQueryMock([
            {
              id: 'busy-1',
              admin_id: testAdminId,
              start_time: getTomorrowAt(10, 0).toISOString(),
              end_time: getTomorrowAt(11, 0).toISOString(),
              source: 'google_calendar',
            },
          ]);
        }
        return createQueryMock([]);
      });

      const blocks = await getBusyBlocks(testAdminId, tomorrow, dayAfter);

      expect(blocks.length).toBe(1);
    });
  });
});
