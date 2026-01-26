import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { addDays, addHours } from 'date-fns';

// ============================================
// MOCKS - Must be before imports
// ============================================

// Store mock data
let mockBookings: Record<string, unknown>[] = [];
let mockSlots: Record<string, unknown>[] = [];
let mockEvents: Record<string, unknown>[] = [];
let mockAdmins: Record<string, unknown>[] = [];
let capturedUpdates: Record<string, unknown> = {};

// Mock external services
vi.mock('@/lib/google', () => ({
  addAttendeeToEvent: vi.fn().mockResolvedValue(undefined),
  removeAttendeeFromEvent: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
  updateCalendarEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/hubspot', () => ({
  findOrCreateContact: vi.fn().mockResolvedValue({ id: 'hs-contact-123' }),
  logMeetingActivity: vi.fn().mockResolvedValue(undefined),
  updateMeetingOutcome: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/slack', () => ({
  notifyNewBooking: vi.fn().mockResolvedValue(undefined),
  notifyCancellation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ email: 'admin@test.com' }),
  getHostWithTokens: vi.fn().mockImplementation(async () => mockAdmins[0] || null),
}));

// Create mock Supabase client
function createMockSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'oh_bookings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((field: string, value: unknown) => {
              if (field === 'manage_token') {
                const booking = mockBookings.find((b) => b.manage_token === value);
                const bookingWithRelations = booking
                  ? {
                      ...booking,
                      slot: { ...mockSlots[0], event: mockEvents[0] },
                      assigned_host: null,
                    }
                  : null;
                return {
                  // Support .eq().single() pattern (GET route)
                  single: vi.fn().mockResolvedValue({
                    data: bookingWithRelations,
                    error: booking ? null : { code: 'PGRST116', message: 'Not found' },
                  }),
                  // Support .eq().is().single() pattern (PUT/DELETE routes)
                  is: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: booking && !booking.cancelled_at ? bookingWithRelations : null,
                      error: booking && !booking.cancelled_at ? null : { code: 'PGRST116', message: 'Not found' },
                    }),
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                          data: null,
                          error: { code: 'PGRST116' },
                        }),
                      }),
                    }),
                  }),
                };
              }
              return {
                single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
                is: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
                }),
              };
            }),
          }),
          update: vi.fn().mockImplementation((updates) => {
            capturedUpdates = { ...capturedUpdates, ...updates };
            return {
              eq: vi.fn().mockImplementation((field, value) => {
                const booking = mockBookings.find((b) => b[field] === value);
                if (booking) {
                  Object.assign(booking, updates);
                }
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: booking, error: null }),
                  }),
                  then: (resolve: (val: unknown) => void) => {
                    resolve({ data: null, error: null });
                    return Promise.resolve({ data: null, error: null });
                  },
                };
              }),
            };
          }),
        };
      }

      if (table === 'oh_slots') {
        const slotsWithBookings = mockSlots.map((slot) => ({
          ...slot,
          event: mockEvents[0],
          bookings: [
            {
              count: mockBookings.filter(
                (b) => b.slot_id === slot.id && !b.cancelled_at && !b.is_waitlisted
              ).length,
            },
          ],
        }));

        // Create chainable methods that eventually resolve
        const createChain = () => {
          const chain: Record<string, unknown> = {};
          const methods = ['eq', 'gt', 'lt', 'gte', 'lte', 'is', 'neq'];
          methods.forEach((method) => {
            chain[method] = vi.fn().mockReturnValue(chain);
          });
          chain.order = vi.fn().mockReturnValue({
            ...chain,
            then: (resolve: (val: unknown) => void) => {
              resolve({ data: slotsWithBookings, error: null });
              return Promise.resolve({ data: slotsWithBookings, error: null });
            },
          });
          chain.single = vi.fn().mockResolvedValue({
            data: slotsWithBookings[0] || null,
            error: slotsWithBookings[0] ? null : { message: 'Not found' },
          });
          return chain;
        };

        return {
          select: vi.fn().mockReturnValue(createChain()),
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

      // Default fallback
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
    duration_minutes: 30,
    max_attendees: 1,
    min_notice_hours: 1,
    booking_window_days: 60,
    meeting_type: 'one_on_one',
    waitlist_enabled: false,
    display_timezone: 'America/New_York',
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
    google_event_id: 'gcal-123',
    google_meet_link: 'https://meet.google.com/abc-123',
    ...overrides,
  };
}

function createMockAdmin(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'admin-123',
    email: 'host@test.com',
    name: 'Test Host',
    google_access_token: 'mock-token',
    google_refresh_token: 'mock-refresh',
    ...overrides,
  };
}

function createMockBooking(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'booking-123',
    slot_id: 'slot-123',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    manage_token: 'test-manage-token',
    cancelled_at: null,
    is_waitlisted: false,
    attendee_timezone: 'America/New_York',
    ...overrides,
  };
}

// ============================================
// TESTS
// ============================================

describe('Manage API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBookings = [createMockBooking()];
    mockSlots = [createMockSlot()];
    mockEvents = [createMockEvent()];
    mockAdmins = [createMockAdmin()];
    capturedUpdates = {};
    mockSupabase = createMockSupabaseClient();
  });

  afterEach(() => {
    mockBookings = [];
    mockSlots = [];
    mockEvents = [];
    mockAdmins = [];
    capturedUpdates = {};
  });

  describe('GET /api/manage/[token] - Get Booking Details', () => {
    it('returns booking details for valid token', async () => {
      const { GET } = await import('@/app/api/manage/[token]/route');

      const request = new NextRequest('http://localhost:3000/api/manage/test-manage-token');
      const response = await GET(request, { params: Promise.resolve({ token: 'test-manage-token' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      // Response structure is { booking: {...}, slot: {...}, event: {...}, availableSlots: [...] }
      expect(data.booking.first_name).toBe('John');
      expect(data.booking.last_name).toBe('Doe');
      expect(data.booking.email).toBe('john@example.com');
      expect(data.slot).toBeDefined();
      expect(data.event).toBeDefined();
    });

    it('returns 404 for invalid token', async () => {
      mockBookings = []; // No bookings
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/manage/[token]/route');

      const request = new NextRequest('http://localhost:3000/api/manage/invalid-token');
      const response = await GET(request, { params: Promise.resolve({ token: 'invalid-token' }) });

      expect(response.status).toBe(404);
    });

    it('includes cancelled_at in response for cancelled bookings', async () => {
      const cancelledAt = new Date().toISOString();
      mockBookings = [createMockBooking({ cancelled_at: cancelledAt })];
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import('@/app/api/manage/[token]/route');

      const request = new NextRequest('http://localhost:3000/api/manage/test-manage-token');
      const response = await GET(request, { params: Promise.resolve({ token: 'test-manage-token' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.booking.cancelled_at).toBe(cancelledAt);
    });
  });

  describe('DELETE /api/manage/[token] - Cancel Booking', () => {
    it('sets cancelled_at timestamp', async () => {
      const { DELETE } = await import('@/app/api/manage/[token]/route');

      const request = new NextRequest('http://localhost:3000/api/manage/test-manage-token', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ token: 'test-manage-token' }) });

      expect(response.status).toBe(200);
      expect(capturedUpdates.cancelled_at).toBeTruthy();
    });

    it('returns 404 for invalid token', async () => {
      mockBookings = [];
      mockSupabase = createMockSupabaseClient();

      const { DELETE } = await import('@/app/api/manage/[token]/route');

      const request = new NextRequest('http://localhost:3000/api/manage/invalid-token', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ token: 'invalid-token' }) });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/manage/[token] - Reschedule Booking', () => {
    it('updates slot_id to new slot', async () => {
      // Add a new available slot
      const newSlot = createMockSlot({ id: 'slot-456' });
      mockSlots.push(newSlot);
      mockSupabase = createMockSupabaseClient();

      const { PUT } = await import('@/app/api/manage/[token]/route');

      const request = new NextRequest('http://localhost:3000/api/manage/test-manage-token', {
        method: 'PUT',
        body: JSON.stringify({ new_slot_id: 'slot-456' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request, { params: Promise.resolve({ token: 'test-manage-token' }) });

      expect(response.status).toBe(200);
      expect(capturedUpdates.slot_id).toBe('slot-456');
    });

    it('returns 400 when new_slot_id is missing', async () => {
      const { PUT } = await import('@/app/api/manage/[token]/route');

      const request = new NextRequest('http://localhost:3000/api/manage/test-manage-token', {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request, { params: Promise.resolve({ token: 'test-manage-token' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('returns 404 for invalid token', async () => {
      mockBookings = [];
      mockSupabase = createMockSupabaseClient();

      const { PUT } = await import('@/app/api/manage/[token]/route');

      const request = new NextRequest('http://localhost:3000/api/manage/invalid-token', {
        method: 'PUT',
        body: JSON.stringify({ new_slot_id: 'slot-456' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request, { params: Promise.resolve({ token: 'invalid-token' }) });

      expect(response.status).toBe(404);
    });
  });
});
