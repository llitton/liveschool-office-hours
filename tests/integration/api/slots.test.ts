import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { addDays, addHours } from 'date-fns';

// ============================================
// MOCKS
// ============================================

let mockSession: { email: string; google_access_token?: string; google_refresh_token?: string } | null = null;
let mockEvents: Record<string, unknown>[] = [];
let mockSlots: Record<string, unknown>[] = [];
let mockAdmins: Record<string, unknown>[] = [];

// Mock auth module
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
  getHostWithTokens: vi.fn((hostId: string) => {
    const admin = mockAdmins.find((a) => a.id === hostId);
    return Promise.resolve(admin || null);
  }),
}));

// Mock Google APIs
vi.mock('@/lib/google', () => ({
  createCalendarEvent: vi.fn().mockResolvedValue({
    eventId: 'gcal-event-123',
    meetLink: 'https://meet.google.com/abc-xyz',
  }),
  getFreeBusy: vi.fn().mockResolvedValue([]),
}));

// Mock availability
vi.mock('@/lib/availability', () => ({
  checkTimeAvailability: vi.fn().mockResolvedValue({ available: true }),
}));

// Create mock Supabase client factory
function createMockSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'oh_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockEvents[0] || null,
                error: mockEvents[0] ? null : { message: 'Not found' },
              }),
            }),
          }),
        };
      }

      if (table === 'oh_slots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockSlots,
                error: null,
              }),
            }),
          }),
          insert: vi.fn().mockImplementation((data) => {
            const newSlot = {
              id: `slot-${Date.now()}`,
              created_at: new Date().toISOString(),
              ...data,
            };
            mockSlots.push(newSlot);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: newSlot, error: null }),
              }),
            };
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

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    }),
  };
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: () => mockSupabase,
}));

// ============================================
// TEST HELPERS
// ============================================

function createMockEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'event-123',
    slug: 'test-event',
    name: 'Test Event',
    host_name: 'Test Host',
    host_email: 'host@test.com',
    host_id: 'admin-123',
    duration_minutes: 30,
    max_attendees: 5,
    buffer_before: 0,
    buffer_after: 0,
    description: 'Test event description',
    ...overrides,
  };
}

function createMockSlot(overrides: Partial<Record<string, unknown>> = {}) {
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(14, 0, 0, 0);

  return {
    id: 'slot-123',
    event_id: 'event-123',
    start_time: tomorrow.toISOString(),
    end_time: addHours(tomorrow, 1).toISOString(),
    is_cancelled: false,
    google_event_id: null,
    google_meet_link: null,
    ...overrides,
  };
}

function createMockAdmin(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'admin-123',
    email: 'admin@test.com',
    name: 'Test Admin',
    google_access_token: 'mock-token',
    google_refresh_token: 'mock-refresh',
    ...overrides,
  };
}

function createSlotRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/slots', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================
// TESTS
// ============================================

describe('Slots API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { email: 'admin@test.com' };
    mockEvents = [createMockEvent()];
    mockSlots = [];
    mockAdmins = [createMockAdmin()];
    mockSupabase = createMockSupabaseClient();
  });

  afterEach(() => {
    mockSession = null;
    mockEvents = [];
    mockSlots = [];
    mockAdmins = [];
  });

  describe('Priority 8: Admin Permission Denies Slot Creation for Non-Admin', () => {
    it('returns 401 Unauthorized when no session exists', async () => {
      mockSession = null;

      const { POST } = await import('@/app/api/slots/route');

      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(14, 0, 0, 0);

      const request = createSlotRequest({
        event_id: 'event-123',
        start_time: tomorrow.toISOString(),
        end_time: addHours(tomorrow, 1).toISOString(),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('allows slot creation when session exists', async () => {
      mockSession = {
        email: 'admin@test.com',
        google_access_token: 'token',
        google_refresh_token: 'refresh',
      };

      const { POST } = await import('@/app/api/slots/route');

      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(14, 0, 0, 0);

      const request = createSlotRequest({
        event_id: 'event-123',
        start_time: tomorrow.toISOString(),
        end_time: addHours(tomorrow, 1).toISOString(),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/slots - Create Slot', () => {
    it('creates slot with valid data', async () => {
      const { POST } = await import('@/app/api/slots/route');

      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(14, 0, 0, 0);
      const endTime = addHours(tomorrow, 1);

      const request = createSlotRequest({
        event_id: 'event-123',
        start_time: tomorrow.toISOString(),
        end_time: endTime.toISOString(),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.event_id).toBe('event-123');
      expect(data.start_time).toBe(tomorrow.toISOString());
    });

    it('rejects slot creation with missing required fields', async () => {
      const { POST } = await import('@/app/api/slots/route');

      const request = createSlotRequest({
        event_id: 'event-123',
        // Missing start_time and end_time
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('rejects slot for non-existent event', async () => {
      mockEvents = []; // No events
      mockSupabase = createMockSupabaseClient();

      const { POST } = await import('@/app/api/slots/route');

      const tomorrow = addDays(new Date(), 1);

      const request = createSlotRequest({
        event_id: 'non-existent-event',
        start_time: tomorrow.toISOString(),
        end_time: addHours(tomorrow, 1).toISOString(),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Event not found');
    });

    it('rejects slot that conflicts with existing slot when buffer is set', async () => {
      // Event with 15min buffer
      mockEvents = [createMockEvent({ buffer_before: 15, buffer_after: 15 })];

      // Existing slot at 2pm-3pm tomorrow
      const existingSlotTime = addDays(new Date(), 1);
      existingSlotTime.setHours(14, 0, 0, 0);

      mockSlots = [
        createMockSlot({
          start_time: existingSlotTime.toISOString(),
          end_time: addHours(existingSlotTime, 1).toISOString(),
        }),
      ];

      mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'oh_events') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockEvents[0],
                    error: null,
                  }),
                }),
              }),
            };
          }

          if (table === 'oh_slots') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: mockSlots,
                    error: null,
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
                    data: mockAdmins[0],
                    error: null,
                  }),
                }),
              }),
            };
          }

          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }),
      };

      const { POST } = await import('@/app/api/slots/route');

      // Try to create slot at 3pm (within 15min buffer of existing 2-3pm slot)
      const conflictingTime = addDays(new Date(), 1);
      conflictingTime.setHours(15, 0, 0, 0);

      const request = createSlotRequest({
        event_id: 'event-123',
        start_time: conflictingTime.toISOString(),
        end_time: addHours(conflictingTime, 1).toISOString(),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('conflicts');
    });

    it('creates slot with assigned host', async () => {
      const hostId = 'host-456';
      mockAdmins = [createMockAdmin({ id: hostId, email: 'host@test.com' })];

      const { POST } = await import('@/app/api/slots/route');

      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(14, 0, 0, 0);

      const request = createSlotRequest({
        event_id: 'event-123',
        start_time: tomorrow.toISOString(),
        end_time: addHours(tomorrow, 1).toISOString(),
        assigned_host_id: hostId,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.assigned_host_id).toBe(hostId);
    });
  });

  describe('GET /api/slots - List Slots', () => {
    it('returns slots for event', async () => {
      mockSlots = [createMockSlot()];
      mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'oh_events') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockEvents[0],
                    error: null,
                  }),
                }),
              }),
            };
          }

          if (table === 'oh_slots') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    gte: vi.fn().mockReturnValue({
                      order: vi.fn().mockResolvedValue({
                        data: mockSlots.map((s) => ({
                          ...s,
                          bookings: [{ count: 0 }],
                          assigned_host: null,
                        })),
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            };
          }

          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }),
      };

      const { GET } = await import('@/app/api/slots/route');

      const request = new NextRequest(
        'http://localhost:3000/api/slots?eventId=event-123'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('requires eventId parameter', async () => {
      const { GET } = await import('@/app/api/slots/route');

      const request = new NextRequest('http://localhost:3000/api/slots');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('eventId is required');
    });

    it('returns 404 for non-existent event', async () => {
      mockEvents = [];
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/slots/route');

      const request = new NextRequest(
        'http://localhost:3000/api/slots?eventId=non-existent'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Event not found');
    });
  });

  describe('Calendar Integration', () => {
    it('creates Google Calendar event when tokens available', async () => {
      mockSession = {
        email: 'admin@test.com',
        google_access_token: 'token',
        google_refresh_token: 'refresh',
      };

      const { createCalendarEvent } = await import('@/lib/google');

      const { POST } = await import('@/app/api/slots/route');

      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(14, 0, 0, 0);

      const request = createSlotRequest({
        event_id: 'event-123',
        start_time: tomorrow.toISOString(),
        end_time: addHours(tomorrow, 1).toISOString(),
      });

      await POST(request);

      expect(createCalendarEvent).toHaveBeenCalled();
    });
  });
});
