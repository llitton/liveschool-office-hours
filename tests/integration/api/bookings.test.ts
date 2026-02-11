import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { addDays, addHours } from 'date-fns';

// ============================================
// MOCKS
// ============================================

// Store mock data for assertions
let mockBookings: Record<string, unknown>[] = [];
let mockSlots: Record<string, unknown>[] = [];
let mockEvents: Record<string, unknown>[] = [];
let mockAdmins: Record<string, unknown>[] = [];

// Mock crypto for token generation
vi.mock('crypto', () => ({
  default: {
    randomBytes: () => ({
      toString: () => 'mock-manage-token-12345',
    }),
  },
}));

// Mock external services
vi.mock('@/lib/google', () => ({
  addAttendeeToEvent: vi.fn().mockResolvedValue(undefined),
  removeAttendeeFromEvent: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
  createCalendarEvent: vi.fn().mockResolvedValue({ eventId: 'gcal-new-123', meetLink: 'https://meet.google.com/new-123' }),
  updateCalendarEventDescription: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/hubspot', () => ({
  findOrCreateContact: vi.fn().mockResolvedValue({ id: 'hs-contact-123' }),
  logMeetingActivity: vi.fn().mockResolvedValue(undefined),
  updateMeetingOutcome: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/slack', () => ({
  notifyNewBooking: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ email: 'admin@test.com' }),
}));

vi.mock('@/lib/prep-matcher', () => ({
  matchPrepResources: vi.fn().mockResolvedValue([]),
  formatResourcesForEmail: vi.fn().mockReturnValue(''),
}));

vi.mock('@/lib/round-robin', () => ({
  selectNextHost: vi.fn().mockResolvedValue(null),
  getParticipatingHosts: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/sms', () => ({
  formatPhoneE164: vi.fn((phone) => (phone ? `+1${phone.replace(/\D/g, '')}` : null)),
}));

// Create mock Supabase client factory
function createMockSupabaseClient() {
  const createChainableMock = (finalResult: unknown) => {
    const chain: Record<string, unknown> = {};
    const methods = ['select', 'eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'is', 'in', 'order', 'limit'];

    methods.forEach((method) => {
      chain[method] = vi.fn().mockReturnValue(chain);
    });

    chain.single = vi.fn().mockResolvedValue(finalResult);
    chain.then = (resolve: (val: unknown) => void) => {
      resolve(finalResult);
      return Promise.resolve(finalResult);
    };

    return chain;
  };

  return {
    // Mock the RPC function for atomic booking creation
    rpc: vi.fn().mockImplementation((funcName: string, params: Record<string, unknown>) => {
      if (funcName === 'create_booking_atomic') {
        // Check for duplicate booking
        const existingBooking = mockBookings.find(
          (b) => b.slot_id === params.p_slot_id &&
                 (b.email as string).toLowerCase() === (params.p_email as string).toLowerCase() &&
                 !b.cancelled_at
        );
        if (existingBooking) {
          return Promise.resolve({
            data: {
              success: false,
              error: 'You have already booked this time slot',
              error_code: 'DUPLICATE_BOOKING',
            },
            error: null,
          });
        }

        // Check capacity
        const event = mockEvents[0] as { max_attendees: number; waitlist_enabled?: boolean };
        const confirmedCount = mockBookings.filter(
          (b) => b.slot_id === params.p_slot_id && !b.cancelled_at && !b.is_waitlisted
        ).length;

        let isWaitlisted = false;
        let waitlistPosition: number | null = null;

        if (confirmedCount >= event.max_attendees) {
          if (!event.waitlist_enabled) {
            return Promise.resolve({
              data: {
                success: false,
                error: 'This time slot is full',
                error_code: 'SLOT_FULL',
              },
              error: null,
            });
          }
          // Add to waitlist
          isWaitlisted = true;
          waitlistPosition = mockBookings.filter(
            (b) => b.slot_id === params.p_slot_id && !b.cancelled_at && b.is_waitlisted
          ).length + 1;
        }

        // Create the booking
        const newBooking = {
          id: `booking-${Date.now()}`,
          slot_id: params.p_slot_id,
          first_name: params.p_first_name,
          last_name: params.p_last_name,
          email: (params.p_email as string).toLowerCase(),
          manage_token: params.p_manage_token,
          question_responses: params.p_question_responses,
          attendee_timezone: params.p_attendee_timezone,
          assigned_host_id: params.p_assigned_host_id,
          phone: params.p_phone,
          sms_consent: params.p_sms_consent,
          guest_emails: params.p_guest_emails,
          is_waitlisted: isWaitlisted,
          waitlist_position: waitlistPosition,
          cancelled_at: null,
          created_at: new Date().toISOString(),
        };
        mockBookings.push(newBooking);

        return Promise.resolve({
          data: {
            success: true,
            booking_id: newBooking.id,
            is_waitlisted: isWaitlisted,
            waitlist_position: waitlistPosition,
            created_at: newBooking.created_at,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    from: vi.fn((table: string) => {
      if (table === 'oh_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(async () => {
                const event = mockEvents[0];
                if (!event) return { data: null, error: { message: 'Not found' } };
                return { data: event, error: null };
              }),
            }),
          }),
        };
      }

      if (table === 'oh_slots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(async () => {
                const slot = mockSlots[0];
                if (!slot) return { data: null, error: { message: 'Not found' } };
                const event = mockEvents[0];
                const bookingCount = mockBookings.filter(
                  (b) => b.slot_id === slot.id && !b.cancelled_at
                ).length;
                return {
                  data: {
                    ...slot,
                    event,
                    bookings: [{ count: bookingCount }],
                  },
                  error: null,
                };
              }),
            }),
          }),
          insert: vi.fn().mockImplementation((data) => {
            const newSlot = {
              id: `slot-dynamic-${Date.now()}`,
              created_at: new Date().toISOString(),
              ...data,
            };
            // Add to mockSlots so subsequent queries find it
            mockSlots.push(newSlot);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: newSlot, error: null }),
              }),
            };
          }),
          update: vi.fn().mockReturnValue(createChainableMock({ data: null, error: null })),
        };
      }

      if (table === 'oh_bookings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((field: string, value: unknown) => {
              // If querying by id, return the specific booking
              if (field === 'id') {
                const booking = mockBookings.find((b) => b.id === value);
                return {
                  single: vi.fn().mockResolvedValue({
                    data: booking || null,
                    error: booking ? null : { code: 'PGRST116' },
                  }),
                };
              }
              // Default chain for other queries
              return {
                is: vi.fn().mockReturnValue({
                  single: vi.fn().mockImplementation(async () => {
                    const existing = mockBookings.find((b) => !b.cancelled_at);
                    return { data: existing || null, error: existing ? null : { code: 'PGRST116' } };
                  }),
                  then: (resolve: (val: unknown) => void) => {
                    const count = mockBookings.filter((b) => !b.cancelled_at).length;
                    resolve({ count, error: null });
                    return Promise.resolve({ count, error: null });
                  },
                  eq: vi.fn().mockReturnValue({
                    then: (resolve: (val: unknown) => void) => {
                      const count = mockBookings.filter((b) => !b.cancelled_at && !b.is_waitlisted).length;
                      resolve({ count, error: null });
                      return Promise.resolve({ count, error: null });
                    },
                  }),
                }),
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    single: vi.fn().mockImplementation(async () => {
                      return { data: null, error: { code: 'PGRST116' } };
                    }),
                  }),
                }),
              };
            }),
          }),
          insert: vi.fn().mockImplementation((data) => {
            const newBooking = {
              id: `booking-${Date.now()}`,
              created_at: new Date().toISOString(),
              ...data,
            };
            mockBookings.push(newBooking);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: newBooking, error: null }),
              }),
            };
          }),
          update: vi.fn().mockImplementation((updates) => {
            return {
              eq: vi.fn().mockImplementation((field, value) => {
                const booking = mockBookings.find((b) => (b as { id: string }).id === value);
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

      return createChainableMock({ data: [], error: null });
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

// Test constants - use valid UUIDs for slot and event IDs
const TEST_SLOT_ID = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
const TEST_EVENT_ID = 'f1e2d3c4-b5a6-4987-8765-432109876543';

function createMockEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TEST_EVENT_ID,
    slug: 'test-event',
    name: 'Test Event',
    host_name: 'Test Host',
    host_email: 'host@test.com',
    duration_minutes: 30,
    max_attendees: 1,
    min_notice_hours: 1,
    booking_window_days: 60,
    max_daily_bookings: null,
    max_weekly_bookings: null,
    require_approval: false,
    meeting_type: 'one_on_one',
    waitlist_enabled: false,
    waitlist_limit: null,
    sms_reminders_enabled: false,
    sms_phone_required: false,
    display_timezone: 'America/New_York',
    ...overrides,
  };
}

function createMockSlot(overrides: Partial<Record<string, unknown>> = {}) {
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(14, 0, 0, 0);

  return {
    id: TEST_SLOT_ID,
    event_id: TEST_EVENT_ID,
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

function createMockRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/bookings', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================
// TESTS
// ============================================

describe('Bookings API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBookings = [];
    mockSlots = [createMockSlot()];
    mockEvents = [createMockEvent()];
    mockAdmins = [createMockAdmin()];
    mockSupabase = createMockSupabaseClient();
  });

  afterEach(() => {
    mockBookings = [];
    mockSlots = [];
    mockEvents = [];
    mockAdmins = [];
  });

  describe('POST /api/bookings - Create Booking', () => {
    it('creates booking with valid data', async () => {
      const { POST } = await import('@/app/api/bookings/route');

      const request = createMockRequest({
        slot_id: TEST_SLOT_ID,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.first_name).toBe('John');
      expect(data.last_name).toBe('Doe');
      expect(data.email).toBe('john@example.com');
    });

    it('rejects booking with missing required fields', async () => {
      const { POST } = await import('@/app/api/bookings/route');

      const request = createMockRequest({
        slot_id: TEST_SLOT_ID,
        // Missing first_name, last_name, email
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('rejects booking for cancelled slot', async () => {
      mockSlots = [createMockSlot({ is_cancelled: true })];
      mockSupabase = createMockSupabaseClient();

      const { POST } = await import('@/app/api/bookings/route');

      const request = createMockRequest({
        slot_id: TEST_SLOT_ID,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('no longer available');
    });

    it('rejects booking that violates min notice hours', async () => {
      // Slot is only 30 minutes from now, but min_notice is 1 hour
      const soon = addHours(new Date(), 0.5);
      mockSlots = [createMockSlot({ start_time: soon.toISOString() })];
      mockEvents = [createMockEvent({ min_notice_hours: 1 })];
      mockSupabase = createMockSupabaseClient();

      const { POST } = await import('@/app/api/bookings/route');

      const request = createMockRequest({
        slot_id: TEST_SLOT_ID,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('advance notice');
    });
  });

  describe('Priority 4: Booking Idempotency', () => {
    it('prevents duplicate booking from same email for same slot', async () => {
      // First, add an existing booking
      mockBookings = [
        {
          id: 'existing-booking',
          slot_id: TEST_SLOT_ID,
          email: 'john@example.com',
          first_name: 'John',
          last_name: 'Doe',
          cancelled_at: null,
        },
      ];

      // Recreate the mock client to pick up the existing booking
      mockSupabase = createMockSupabaseClient();

      const { POST } = await import('@/app/api/bookings/route');

      const request = createMockRequest({
        slot_id: TEST_SLOT_ID,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('already booked');
    });
  });

  describe('Priority 5: Race Condition Prevention', () => {
    it('prevents booking when slot is full', async () => {
      // Slot has max_attendees: 1, but already has 1 booking
      mockBookings = [
        {
          id: 'existing-booking',
          slot_id: TEST_SLOT_ID,
          email: 'existing@example.com',
          first_name: 'Existing',
          last_name: 'User',
          cancelled_at: null,
          is_waitlisted: false,
        },
      ];
      mockEvents = [createMockEvent({ max_attendees: 1, waitlist_enabled: false })];
      mockSupabase = createMockSupabaseClient();

      const { POST } = await import('@/app/api/bookings/route');

      const request = createMockRequest({
        slot_id: TEST_SLOT_ID,
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('full');
    });

    it('adds to waitlist when slot is full but waitlist enabled', async () => {
      mockBookings = [
        {
          id: 'existing-booking',
          slot_id: TEST_SLOT_ID,
          email: 'existing@example.com',
          first_name: 'Existing',
          last_name: 'User',
          cancelled_at: null,
          is_waitlisted: false,
        },
      ];
      mockEvents = [createMockEvent({ max_attendees: 1, waitlist_enabled: true })];
      mockSupabase = createMockSupabaseClient();

      const { POST } = await import('@/app/api/bookings/route');

      const request = createMockRequest({
        slot_id: TEST_SLOT_ID,
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Find the newly created booking
      const newBooking = mockBookings.find(b => b.email === 'jane@example.com');
      expect(newBooking).toBeTruthy();
      expect(newBooking?.is_waitlisted).toBe(true);
      expect(newBooking?.waitlist_position).toBeGreaterThan(0);
    });
  });

  describe('Round-Robin Dynamic Slot Booking', () => {
    it('books round-robin dynamic slot using assigned host, not primary host', async () => {
      // Set up a round-robin event where the primary host has a conflict
      // but a participating host is available
      const rrEvent = createMockEvent({
        meeting_type: 'round_robin',
        round_robin_strategy: 'least_bookings',
        round_robin_period: 'week',
        host_email: 'primary@test.com',
      });
      mockEvents = [rrEvent];

      // The assigned (participating) host
      const assignedHostAdmin = createMockAdmin({
        id: 'host-b-123',
        email: 'hostb@test.com',
        name: 'Host B',
      });

      // Primary host admin (has a calendar conflict, but round-robin shouldn't check them)
      mockAdmins = [createMockAdmin({ email: 'primary@test.com', name: 'Primary Host' })];

      mockSupabase = createMockSupabaseClient();

      // Mock round-robin to return the assigned host
      const { getParticipatingHosts, selectNextHost } = await import('@/lib/round-robin');
      vi.mocked(getParticipatingHosts).mockResolvedValue(['host-b-123', 'host-c-456']);
      vi.mocked(selectNextHost).mockResolvedValue({
        hostId: 'host-b-123',
        host: assignedHostAdmin as unknown as import('@/types').OHAdmin,
        reason: 'least_bookings',
      });

      const { POST } = await import('@/app/api/bookings/route');

      // Use a dynamic slot ID (simulates calendar-based availability)
      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(18, 0, 0, 0); // 6 PM UTC = 12 PM CT
      const dynamicSlotId = `dynamic-${tomorrow.toISOString()}`;

      // For the slot re-fetch after creation, put the dynamic slot in mockSlots
      const dynamicSlot = createMockSlot({
        id: `slot-dynamic-${Date.now()}`,
        start_time: tomorrow.toISOString(),
        end_time: addHours(tomorrow, 0.25).toISOString(), // 15 min
        assigned_host_id: 'host-b-123',
      });
      mockSlots = [dynamicSlot];

      const request = createMockRequest({
        slot_id: dynamicSlotId,
        event_id: TEST_EVENT_ID,
        first_name: 'Jose Martin',
        last_name: 'Montoya Dura',
        email: 'jmontoyadura@cps.edu',
      });

      const response = await POST(request);
      const data = await response.json();

      // Should succeed — selectNextHost picks an available host
      // even if the primary host has a calendar conflict
      expect(response.status).toBe(200);
      expect(data.email).toBe('jmontoyadura@cps.edu');

      // Verify selectNextHost was called (not checkTimeAvailability against primary host)
      expect(vi.mocked(selectNextHost)).toHaveBeenCalledWith(
        TEST_EVENT_ID,
        expect.any(Date),
        expect.any(Date),
        expect.objectContaining({
          strategy: 'least_bookings',
          hostIds: ['host-b-123', 'host-c-456'],
        }),
        false
      );
    });

    it('returns error when all round-robin hosts are unavailable for dynamic slot', async () => {
      const rrEvent = createMockEvent({
        meeting_type: 'round_robin',
        round_robin_strategy: 'cycle',
        host_email: 'primary@test.com',
      });
      mockEvents = [rrEvent];
      mockAdmins = [createMockAdmin({ email: 'primary@test.com' })];
      mockSupabase = createMockSupabaseClient();

      const { getParticipatingHosts, selectNextHost } = await import('@/lib/round-robin');
      vi.mocked(getParticipatingHosts).mockResolvedValue(['host-a', 'host-b']);
      // selectNextHost returns null when no host is available
      vi.mocked(selectNextHost).mockResolvedValue(null);

      const { POST } = await import('@/app/api/bookings/route');

      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(18, 0, 0, 0);
      const dynamicSlotId = `dynamic-${tomorrow.toISOString()}`;

      const request = createMockRequest({
        slot_id: dynamicSlotId,
        event_id: TEST_EVENT_ID,
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('unavailable');
    });
  });
});

// Manage route tests are in a separate file: tests/integration/api/manage.test.ts
