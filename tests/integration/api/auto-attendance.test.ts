import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// MOCKS
// ============================================

const mockGetMeetParticipants = vi.fn();
const mockMatchParticipantsToBookings = vi.fn();
const mockUpdateMeetingOutcome = vi.fn();

// Track booking update calls for assertions
let bookingUpdateCalls: Array<{ updates: Record<string, unknown>; bookingId: string }> = [];

// Configurable mock data
let slotsQueryResult: { data: Record<string, unknown>[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};
let adminLookup: Map<string, Record<string, unknown> | null> = new Map();

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
                  gt: vi.fn().mockResolvedValue(slotsQueryResult),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'oh_admins') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_field: string, value: string) => ({
              single: vi.fn().mockResolvedValue({
                data: adminLookup.get(value) ?? null,
                error: adminLookup.has(value) ? null : { message: 'Not found' },
              }),
            })),
          }),
        };
      }

      if (table === 'oh_bookings') {
        return {
          update: vi.fn().mockImplementation((updates: Record<string, unknown>) => ({
            eq: vi.fn().mockImplementation((_field: string, bookingId: string) => {
              bookingUpdateCalls.push({ updates, bookingId });
              return Promise.resolve({ data: null, error: null });
            }),
          })),
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

vi.mock('@/lib/google', () => ({
  getMeetParticipants: (...args: unknown[]) => mockGetMeetParticipants(...args),
  matchParticipantsToBookings: (...args: unknown[]) => mockMatchParticipantsToBookings(...args),
}));

vi.mock('@/lib/hubspot', () => ({
  updateMeetingOutcome: (...args: unknown[]) => mockUpdateMeetingOutcome(...args),
}));

vi.mock('@/lib/logger', () => ({
  cronLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================
// TEST HELPERS
// ============================================

function createMockSlot(overrides: Partial<Record<string, unknown>> = {}) {
  const endTime = new Date();
  endTime.setMinutes(endTime.getMinutes() - 60); // Ended 60 min ago (within 30-90 window)

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

function createRequest(authToken?: string): Request {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['authorization'] = `Bearer ${authToken}`;
  }
  return new Request('http://localhost:3000/api/cron/auto-attendance', {
    method: 'GET',
    headers,
  });
}

// ============================================
// TESTS
// ============================================

describe('Auto-Attendance Cron Integration Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    bookingUpdateCalls = [];
    slotsQueryResult = { data: [createMockSlot()], error: null };
    adminLookup = new Map([['host@test.com', createMockAdmin()]]);
    mockSupabase = createMockSupabaseClient();

    // Default: participants include attendee1 but not attendee2
    mockGetMeetParticipants.mockResolvedValue({
      participants: [
        { email: 'attendee1@test.com', displayName: 'John Doe', durationMinutes: 25 },
      ],
      error: null,
    });
    mockMatchParticipantsToBookings.mockReturnValue([
      { bookingId: 'booking-1', attended: true },
      { bookingId: 'booking-2', attended: false },
    ]);
    mockUpdateMeetingOutcome.mockResolvedValue(undefined);

    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Authentication', () => {
    it('returns 401 when CRON_SECRET is set and auth header does not match', async () => {
      vi.stubEnv('CRON_SECRET', 'my-secret');

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const response = await GET(createRequest('wrong-secret'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 401 when CRON_SECRET is set and no auth header provided', async () => {
      vi.stubEnv('CRON_SECRET', 'my-secret');

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const response = await GET(createRequest());

      expect(response.status).toBe(401);
    });

    it('allows access when CRON_SECRET matches the auth header', async () => {
      vi.stubEnv('CRON_SECRET', 'my-secret');
      slotsQueryResult = { data: [], error: null };
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const response = await GET(createRequest('my-secret'));

      expect(response.status).toBe(200);
    });

    it('allows access when CRON_SECRET is not set (no auth required)', async () => {
      delete process.env.CRON_SECRET;
      slotsQueryResult = { data: [], error: null };
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const response = await GET();

      expect(response.status).toBe(200);
    });
  });

  describe('Slot Discovery and Processing', () => {
    it('processes eligible slots and marks attendance based on Meet data', async () => {
      const { GET } = await import('@/app/api/cron/auto-attendance/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.slotsProcessed).toBe(1);
      expect(data.bookingsMarkedAttended).toBe(1);
      expect(data.bookingsMarkedNoShow).toBe(1);
    });

    it('returns success with zero counts when no eligible slots found', async () => {
      slotsQueryResult = { data: [], error: null };
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.slotsProcessed).toBe(0);
      expect(data.bookingsMarkedAttended).toBe(0);
      expect(data.bookingsMarkedNoShow).toBe(0);
      expect(data.errors).toBeUndefined();
    });

    it('returns 500 when initial slot query fails', async () => {
      slotsQueryResult = { data: null, error: { message: 'Database connection failed' } };
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch slots');
    });

    it('skips slots without Google Meet links (filtered by query)', async () => {
      // The SQL query uses .not('google_meet_link', 'is', null) to filter these
      // So the mock returns empty when no meet-linked slots exist
      slotsQueryResult = { data: [], error: null };
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slotsProcessed).toBe(0);
      expect(mockGetMeetParticipants).not.toHaveBeenCalled();
    });
  });

  describe('Attendance Marking', () => {
    it('marks bookings as attended with attended_at timestamp', async () => {
      mockMatchParticipantsToBookings.mockReturnValue([
        { bookingId: 'booking-1', attended: true },
      ]);

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      await GET();

      const attendedUpdate = bookingUpdateCalls.find(c => c.bookingId === 'booking-1');
      expect(attendedUpdate).toBeDefined();
      expect(attendedUpdate!.updates.attended_at).toBeDefined();
      expect(attendedUpdate!.updates.no_show_at).toBeUndefined();
    });

    it('marks bookings as no-show with no_show_at timestamp', async () => {
      mockMatchParticipantsToBookings.mockReturnValue([
        { bookingId: 'booking-2', attended: false },
      ]);

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      await GET();

      const noShowUpdate = bookingUpdateCalls.find(c => c.bookingId === 'booking-2');
      expect(noShowUpdate).toBeDefined();
      expect(noShowUpdate!.updates.no_show_at).toBeDefined();
      expect(noShowUpdate!.updates.attended_at).toBeUndefined();
    });

    it('skips slots where all bookings are already marked', async () => {
      slotsQueryResult = {
        data: [createMockSlot({
          bookings: [
            {
              id: 'booking-already-done',
              email: 'done@test.com',
              first_name: 'Done',
              last_name: 'User',
              cancelled_at: null,
              attended_at: new Date().toISOString(), // Already marked
              no_show_at: null,
            },
          ],
        })],
        error: null,
      };
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slotsProcessed).toBe(0);
      expect(mockGetMeetParticipants).not.toHaveBeenCalled();
    });

    it('only processes unmarked bookings, excluding cancelled and already-marked ones', async () => {
      slotsQueryResult = {
        data: [createMockSlot({
          bookings: [
            {
              id: 'unmarked',
              email: 'unmarked@test.com',
              first_name: 'Unmarked',
              last_name: 'User',
              cancelled_at: null,
              attended_at: null,
              no_show_at: null,
              hubspot_contact_id: null,
            },
            {
              id: 'already-attended',
              email: 'attended@test.com',
              first_name: 'Attended',
              last_name: 'User',
              cancelled_at: null,
              attended_at: '2026-01-01T00:00:00Z',
              no_show_at: null,
              hubspot_contact_id: null,
            },
            {
              id: 'already-noshow',
              email: 'noshow@test.com',
              first_name: 'NoShow',
              last_name: 'User',
              cancelled_at: null,
              attended_at: null,
              no_show_at: '2026-01-01T00:00:00Z',
              hubspot_contact_id: null,
            },
            {
              id: 'cancelled',
              email: 'cancelled@test.com',
              first_name: 'Cancelled',
              last_name: 'User',
              cancelled_at: '2026-01-01T00:00:00Z',
              attended_at: null,
              no_show_at: null,
              hubspot_contact_id: null,
            },
          ],
        })],
        error: null,
      };
      mockSupabase = createMockSupabaseClient();

      mockMatchParticipantsToBookings.mockReturnValue([
        { bookingId: 'unmarked', attended: true },
      ]);

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      await GET();

      // matchParticipantsToBookings should only receive the one unmarked booking
      expect(mockMatchParticipantsToBookings).toHaveBeenCalledWith(
        expect.anything(),
        [{ id: 'unmarked', email: 'unmarked@test.com', first_name: 'Unmarked', last_name: 'User' }],
        5 // MIN_ATTENDANCE_DURATION
      );
    });

    it('returns correct counts with multiple bookings (2 attended, 1 no-show)', async () => {
      slotsQueryResult = {
        data: [createMockSlot({
          bookings: [
            { id: 'b1', email: 'a@test.com', first_name: 'A', last_name: 'A', cancelled_at: null, attended_at: null, no_show_at: null, hubspot_contact_id: null },
            { id: 'b2', email: 'b@test.com', first_name: 'B', last_name: 'B', cancelled_at: null, attended_at: null, no_show_at: null, hubspot_contact_id: null },
            { id: 'b3', email: 'c@test.com', first_name: 'C', last_name: 'C', cancelled_at: null, attended_at: null, no_show_at: null, hubspot_contact_id: null },
          ],
        })],
        error: null,
      };
      mockSupabase = createMockSupabaseClient();

      mockGetMeetParticipants.mockResolvedValue({
        participants: [
          { email: 'a@test.com', displayName: 'A', durationMinutes: 20 },
          { email: 'b@test.com', displayName: 'B', durationMinutes: 15 },
        ],
        error: null,
      });

      mockMatchParticipantsToBookings.mockReturnValue([
        { bookingId: 'b1', attended: true },
        { bookingId: 'b2', attended: true },
        { bookingId: 'b3', attended: false },
      ]);

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const response = await GET();
      const data = await response.json();

      expect(data.slotsProcessed).toBe(1);
      expect(data.bookingsMarkedAttended).toBe(2);
      expect(data.bookingsMarkedNoShow).toBe(1);
      expect(data.errors).toBeUndefined();
      expect(bookingUpdateCalls).toHaveLength(3);
    });
  });

  describe('Admin Token Handling', () => {
    it('skips slot when host has no Google tokens', async () => {
      adminLookup = new Map([['host@test.com', createMockAdmin({
        google_access_token: null,
        google_refresh_token: null,
      })]]);
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const { cronLogger } = await import('@/lib/logger');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slotsProcessed).toBe(0);
      expect(mockGetMeetParticipants).not.toHaveBeenCalled();
      expect(cronLogger.warn).toHaveBeenCalledWith(
        'Host Google not connected, skipping auto-attendance',
        expect.any(Object)
      );
    });
  });

  describe('HubSpot Sync', () => {
    it('calls updateMeetingOutcome for no-show booking with hubspot_contact_id', async () => {
      const { GET } = await import('@/app/api/cron/auto-attendance/route');

      await GET();

      // booking-2 has hubspot_contact_id='hs-123' and is marked no-show
      expect(mockUpdateMeetingOutcome).toHaveBeenCalledWith(
        'hs-123',
        'Office Hours',
        'NO_SHOW'
      );
    });

    it('calls updateMeetingOutcome with COMPLETED for attended booking with hubspot_contact_id', async () => {
      slotsQueryResult = {
        data: [createMockSlot({
          bookings: [
            {
              id: 'booking-hs-attended',
              email: 'hs-user@test.com',
              first_name: 'HS',
              last_name: 'User',
              cancelled_at: null,
              attended_at: null,
              no_show_at: null,
              hubspot_contact_id: 'hs-contact-789',
            },
          ],
        })],
        error: null,
      };
      mockSupabase = createMockSupabaseClient();

      mockMatchParticipantsToBookings.mockReturnValue([
        { bookingId: 'booking-hs-attended', attended: true },
      ]);

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      await GET();

      expect(mockUpdateMeetingOutcome).toHaveBeenCalledWith(
        'hs-contact-789',
        'Office Hours',
        'COMPLETED'
      );
    });

    it('does not call updateMeetingOutcome for bookings without hubspot_contact_id', async () => {
      slotsQueryResult = {
        data: [createMockSlot({
          bookings: [
            {
              id: 'no-hs',
              email: 'no-hs@test.com',
              first_name: 'No',
              last_name: 'HS',
              cancelled_at: null,
              attended_at: null,
              no_show_at: null,
              hubspot_contact_id: null,
            },
          ],
        })],
        error: null,
      };
      mockSupabase = createMockSupabaseClient();

      mockMatchParticipantsToBookings.mockReturnValue([
        { bookingId: 'no-hs', attended: true },
      ]);

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      await GET();

      expect(mockUpdateMeetingOutcome).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles getMeetParticipants returning an error for a slot', async () => {
      mockGetMeetParticipants.mockResolvedValue({
        participants: [],
        error: 'Permission denied: Meet API not enabled',
      });

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const { cronLogger } = await import('@/lib/logger');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slotsProcessed).toBe(0);
      expect(data.errors).toBeDefined();
      expect(data.errors).toHaveLength(1);
      expect(data.errors[0]).toContain('slot-123');
      expect(data.errors[0]).toContain('Permission denied');
      expect(mockMatchParticipantsToBookings).not.toHaveBeenCalled();
      expect(cronLogger.warn).toHaveBeenCalledWith(
        'Failed to get Meet participants',
        expect.any(Object)
      );
    });

    it('continues processing remaining slots when one slot throws an error', async () => {
      const slot1 = createMockSlot({
        id: 'slot-fail',
        event: { id: 'event-1', name: 'Failing Event', host_email: 'host@test.com' },
        bookings: [
          { id: 'b-fail', email: 'fail@test.com', first_name: 'Fail', last_name: 'User', cancelled_at: null, attended_at: null, no_show_at: null, hubspot_contact_id: null },
        ],
      });
      const slot2 = createMockSlot({
        id: 'slot-ok',
        event: { id: 'event-2', name: 'Working Event', host_email: 'host2@test.com' },
        bookings: [
          { id: 'b-ok', email: 'ok@test.com', first_name: 'OK', last_name: 'User', cancelled_at: null, attended_at: null, no_show_at: null, hubspot_contact_id: null },
        ],
      });

      slotsQueryResult = { data: [slot1, slot2], error: null };
      adminLookup = new Map([
        ['host@test.com', createMockAdmin({ email: 'host@test.com' })],
        ['host2@test.com', createMockAdmin({ email: 'host2@test.com' })],
      ]);
      mockSupabase = createMockSupabaseClient();

      // First slot throws, second succeeds
      mockGetMeetParticipants
        .mockRejectedValueOnce(new Error('Meet API crashed'))
        .mockResolvedValueOnce({
          participants: [{ email: 'ok@test.com', displayName: 'OK User', durationMinutes: 15 }],
          error: null,
        });

      mockMatchParticipantsToBookings.mockReturnValue([
        { bookingId: 'b-ok', attended: true },
      ]);

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slotsProcessed).toBe(1); // Only second slot processed successfully
      expect(data.bookingsMarkedAttended).toBe(1);
      expect(data.errors).toBeDefined();
      expect(data.errors).toHaveLength(1);
      expect(data.errors[0]).toContain('slot-fail');
      expect(data.errors[0]).toContain('Meet API crashed');
    });
  });

  describe('Correct Arguments Passed to Functions', () => {
    it('passes correct arguments to getMeetParticipants', async () => {
      const slot = createMockSlot({
        google_meet_link: 'https://meet.google.com/xyz-abc-def',
        start_time: '2026-02-01T14:00:00Z',
        end_time: '2026-02-01T14:30:00Z',
      });
      slotsQueryResult = { data: [slot], error: null };
      adminLookup = new Map([['host@test.com', createMockAdmin({
        google_access_token: 'access-xyz',
        google_refresh_token: 'refresh-xyz',
      })]]);
      mockSupabase = createMockSupabaseClient();

      mockMatchParticipantsToBookings.mockReturnValue([]);

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      await GET();

      expect(mockGetMeetParticipants).toHaveBeenCalledWith(
        'access-xyz',
        'refresh-xyz',
        'https://meet.google.com/xyz-abc-def',
        '2026-02-01T14:00:00Z',
        '2026-02-01T14:30:00Z'
      );
    });

    it('passes MIN_ATTENDANCE_DURATION (5) to matchParticipantsToBookings', async () => {
      const participants = [
        { email: 'attendee1@test.com', displayName: 'John Doe', durationMinutes: 25 },
      ];

      mockGetMeetParticipants.mockResolvedValue({
        participants,
        error: null,
      });

      mockMatchParticipantsToBookings.mockReturnValue([
        { bookingId: 'booking-1', attended: true },
      ]);

      const { GET } = await import('@/app/api/cron/auto-attendance/route');
      await GET();

      expect(mockMatchParticipantsToBookings).toHaveBeenCalledWith(
        participants,
        expect.arrayContaining([
          expect.objectContaining({ id: 'booking-1', email: 'attendee1@test.com' }),
        ]),
        5 // MIN_ATTENDANCE_DURATION constant
      );
    });
  });
});
