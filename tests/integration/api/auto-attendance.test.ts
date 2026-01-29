import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// MOCKS
// ============================================

let mockSlots: Record<string, unknown>[] = [];
let mockAdmins: Record<string, unknown>[] = [];
let mockMeetParticipants: { participants: unknown[]; error: string | null } = {
  participants: [],
  error: null,
};
let mockMatches: Array<{ bookingId: string; email: string; attended: boolean; duration: number; matchedBy: string }> = [];
const mockUpdatedBookings: Record<string, unknown>[] = [];

// Mock Supabase
function createMockSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'oh_slots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  gt: vi.fn().mockResolvedValue({
                    data: mockSlots,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'oh_admins') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAdmins[0] || null,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'oh_bookings') {
        return {
          update: vi.fn().mockImplementation((data) => {
            mockUpdatedBookings.push(data);
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    }),
  };
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: () => mockSupabase,
}));

// Mock Google Meet functions
vi.mock('@/lib/google', () => ({
  getMeetParticipants: vi.fn(() => Promise.resolve(mockMeetParticipants)),
  matchParticipantsToBookings: vi.fn(() => mockMatches),
}));

// Mock HubSpot
vi.mock('@/lib/hubspot', () => ({
  updateMeetingOutcome: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  cronLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================
// TEST HELPERS
// ============================================

function createMockSlot(overrides: Partial<Record<string, unknown>> = {}) {
  const endTime = new Date();
  endTime.setMinutes(endTime.getMinutes() - 60); // 60 minutes ago

  return {
    id: 'slot-123',
    event_id: 'event-123',
    start_time: new Date(endTime.getTime() - 30 * 60 * 1000).toISOString(),
    end_time: endTime.toISOString(),
    is_cancelled: false,
    google_meet_link: 'https://meet.google.com/abc-xyz',
    event: {
      id: 'event-123',
      name: 'Office Hours',
      host_email: 'host@test.com',
    },
    bookings: [
      {
        id: 'booking-1',
        email: 'attendee1@test.com',
        first_name: 'John',
        last_name: 'Doe',
        cancelled_at: null,
        attended_at: null,
        no_show_at: null,
        hubspot_contact_id: null,
      },
      {
        id: 'booking-2',
        email: 'attendee2@test.com',
        first_name: 'Jane',
        last_name: 'Smith',
        cancelled_at: null,
        attended_at: null,
        no_show_at: null,
        hubspot_contact_id: 'hs-123',
      },
    ],
    ...overrides,
  };
}

function createMockAdmin(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'admin-123',
    email: 'host@test.com',
    google_access_token: 'mock-token',
    google_refresh_token: 'mock-refresh',
    ...overrides,
  };
}

// ============================================
// TESTS
// ============================================

describe('Auto-Attendance Cron Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSlots = [createMockSlot()];
    mockAdmins = [createMockAdmin()];
    mockMeetParticipants = {
      participants: [
        { email: 'attendee1@test.com', displayName: 'John Doe', durationMinutes: 25 },
      ],
      error: null,
    };
    mockMatches = [
      { bookingId: 'booking-1', email: 'attendee1@test.com', attended: true, duration: 25, matchedBy: 'email' },
      { bookingId: 'booking-2', email: 'attendee2@test.com', attended: false, duration: 0, matchedBy: 'none' },
    ];
    mockUpdatedBookings.length = 0;
    mockSupabase = createMockSupabaseClient();
  });

  afterEach(() => {
    mockSlots = [];
    mockAdmins = [];
    mockMeetParticipants = { participants: [], error: null };
    mockMatches = [];
  });

  describe('GET /api/cron/auto-attendance', () => {
    it('processes slots and marks attendance based on Meet data', async () => {
      const { GET } = await import('@/app/api/cron/auto-attendance/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.slotsProcessed).toBe(1);
      expect(data.bookingsMarkedAttended).toBe(1);
      expect(data.bookingsMarkedNoShow).toBe(1);
    });

    it('skips slots without Google Meet links', async () => {
      mockSlots = [createMockSlot({ google_meet_link: null })];
      mockSupabase = createMockSupabaseClient();

      // The query itself filters out slots without meet links
      // So we simulate this by returning empty
      mockSlots = [];
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/cron/auto-attendance/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slotsProcessed).toBe(0);
    });

    it('skips slots where all bookings are already marked', async () => {
      mockSlots = [
        createMockSlot({
          bookings: [
            {
              id: 'booking-1',
              email: 'attendee@test.com',
              first_name: 'John',
              last_name: 'Doe',
              cancelled_at: null,
              attended_at: new Date().toISOString(), // Already marked
              no_show_at: null,
            },
          ],
        }),
      ];
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/cron/auto-attendance/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slotsProcessed).toBe(0);
    });

    it('skips when host Google is not connected', async () => {
      mockAdmins = [createMockAdmin({ google_access_token: null, google_refresh_token: null })];
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const { cronLogger } = await import('@/lib/logger');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slotsProcessed).toBe(0);
      expect(cronLogger.warn).toHaveBeenCalledWith(
        'Host Google not connected, skipping auto-attendance',
        expect.any(Object)
      );
    });

    it('handles Google Meet API errors gracefully', async () => {
      mockMeetParticipants = { participants: [], error: 'Meet API unavailable' };

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const { cronLogger } = await import('@/lib/logger');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slotsProcessed).toBe(0);
      expect(data.errors).toContain('Slot slot-123: Meet API unavailable');
      expect(cronLogger.warn).toHaveBeenCalledWith(
        'Failed to get Meet participants',
        expect.any(Object)
      );
    });

    it('syncs attendance to HubSpot when contact exists', async () => {
      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const { updateMeetingOutcome } = await import('@/lib/hubspot');

      await GET();

      // booking-2 has hubspot_contact_id, so it should sync
      expect(updateMeetingOutcome).toHaveBeenCalledWith(
        'hs-123',
        'Office Hours',
        'NO_SHOW'
      );
    });
  });
});
