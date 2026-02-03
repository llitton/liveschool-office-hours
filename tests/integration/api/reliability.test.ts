import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { addDays, addHours } from 'date-fns';

// ============================================
// MOCKS - Feedback Rating Validation
// ============================================

// Store mock data for feedback tests
let mockFeedbackBookings: Record<string, unknown>[] = [];
let feedbackCapturedUpdates: Record<string, unknown> = {};

// ============================================
// MOCKS - Manage UUID Validation
// ============================================

// Store mock data for manage tests
let mockManageBookings: Record<string, unknown>[] = [];
let mockManageSlots: Record<string, unknown>[] = [];
let mockManageEvents: Record<string, unknown>[] = [];
let mockManageAdmins: Record<string, unknown>[] = [];
let manageCapturedUpdates: Record<string, unknown> = {};

// ============================================
// MOCKS - Sync Availability Error Reporting
// ============================================

let mockSyncAdmins: Record<string, unknown>[] = [];
let syncCalendarCallCount = 0;
let syncCalendarFailIndices: number[] = [];

// ============================================
// MODULE MOCKS
// ============================================

// Mock external services (needed by manage route)
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
  getHostWithTokens: vi.fn().mockImplementation(async () => mockManageAdmins[0] || null),
}));

vi.mock('@/lib/availability', () => ({
  syncGoogleCalendarBusy: vi.fn().mockImplementation(async () => {
    const currentIndex = syncCalendarCallCount++;
    if (syncCalendarFailIndices.includes(currentIndex)) {
      throw new Error(`Sync failed for admin ${currentIndex}`);
    }
    return undefined;
  }),
}));

vi.mock('@/lib/logger', () => ({
  cronLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  calendarLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================
// MOCK SUPABASE CLIENT FACTORIES
// ============================================

// Factory for feedback token route tests
function createFeedbackMockSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'oh_bookings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((field: string, value: unknown) => {
              if (field === 'manage_token') {
                const booking = mockFeedbackBookings.find((b) => b.manage_token === value);
                return {
                  single: vi.fn().mockResolvedValue({
                    data: booking ? { id: booking.id } : null,
                    error: booking ? null : { code: 'PGRST116', message: 'Not found' },
                  }),
                };
              }
              return {
                single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              };
            }),
          }),
          update: vi.fn().mockImplementation((updates) => {
            feedbackCapturedUpdates = { ...feedbackCapturedUpdates, ...updates };
            return {
              eq: vi.fn().mockImplementation(() => {
                return Promise.resolve({ error: null });
              }),
            };
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

// Factory for manage route tests (same pattern as manage.test.ts)
function createManageMockSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'oh_bookings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((field: string, value: unknown) => {
              if (field === 'manage_token') {
                const booking = mockManageBookings.find((b) => b.manage_token === value);
                const bookingWithRelations = booking
                  ? {
                      ...booking,
                      slot: { ...mockManageSlots[0], event: mockManageEvents[0] },
                      assigned_host: null,
                    }
                  : null;
                return {
                  single: vi.fn().mockResolvedValue({
                    data: bookingWithRelations,
                    error: booking ? null : { code: 'PGRST116', message: 'Not found' },
                  }),
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
            manageCapturedUpdates = { ...manageCapturedUpdates, ...updates };
            return {
              eq: vi.fn().mockImplementation((field, value) => {
                const booking = mockManageBookings.find((b) => b[field] === value);
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
        const slotsWithBookings = mockManageSlots.map((slot) => ({
          ...slot,
          event: mockManageEvents[0],
          bookings: [
            {
              count: mockManageBookings.filter(
                (b) => b.slot_id === slot.id && !b.cancelled_at && !b.is_waitlisted
              ).length,
            },
          ],
        }));

        const createChain = () => {
          let requestedSlotId: string | null = null;
          const chain: Record<string, unknown> = {};
          const methods = ['gt', 'lt', 'gte', 'lte', 'is', 'neq'];
          methods.forEach((method) => {
            chain[method] = vi.fn().mockReturnValue(chain);
          });
          chain.eq = vi.fn().mockImplementation((field: string, value: unknown) => {
            if (field === 'id') {
              requestedSlotId = value as string;
            }
            return chain;
          });
          chain.order = vi.fn().mockReturnValue({
            ...chain,
            then: (resolve: (val: unknown) => void) => {
              resolve({ data: slotsWithBookings, error: null });
              return Promise.resolve({ data: slotsWithBookings, error: null });
            },
          });
          chain.single = vi.fn().mockImplementation(async () => {
            const slot = requestedSlotId
              ? slotsWithBookings.find((s) => s.id === requestedSlotId)
              : slotsWithBookings[0];
            return {
              data: slot || null,
              error: slot ? null : { message: 'Not found' },
            };
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
                data: mockManageAdmins[0] || null,
                error: null,
              }),
            }),
            not: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({
                data: mockSyncAdmins,
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

// Factory for sync-availability cron route tests
function createSyncMockSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'oh_admins') {
        return {
          select: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({
                data: mockSyncAdmins,
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

// Active mock supabase reference - switched per test section
let mockSupabase: ReturnType<typeof createFeedbackMockSupabaseClient> | ReturnType<typeof createManageMockSupabaseClient> | ReturnType<typeof createSyncMockSupabaseClient>;

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: () => mockSupabase,
}));

// ============================================
// TEST HELPERS
// ============================================

function createManageMockEvent(overrides: Partial<Record<string, unknown>> = {}) {
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

function createManageMockSlot(overrides: Partial<Record<string, unknown>> = {}) {
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

function createManageMockAdmin(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'admin-123',
    email: 'host@test.com',
    name: 'Test Host',
    google_access_token: 'mock-token',
    google_refresh_token: 'mock-refresh',
    ...overrides,
  };
}

function createManageMockBooking(overrides: Partial<Record<string, unknown>> = {}) {
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
// TESTS: Feedback Rating Validation
// ============================================

describe('Feedback Rating Validation - POST /api/feedback/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeedbackBookings = [
      {
        id: 'booking-123',
        manage_token: 'valid-feedback-token',
        first_name: 'John',
      },
    ];
    feedbackCapturedUpdates = {};
    mockSupabase = createFeedbackMockSupabaseClient();
  });

  afterEach(() => {
    mockFeedbackBookings = [];
    feedbackCapturedUpdates = {};
  });

  it('rejects non-integer rating of 3.5 with 400', async () => {
    const { POST } = await import('@/app/api/feedback/[token]/route');

    const request = new NextRequest('http://localhost:3000/api/feedback/valid-feedback-token', {
      method: 'POST',
      body: JSON.stringify({ rating: 3.5, comment: 'Good session' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ token: 'valid-feedback-token' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Rating must be an integer between 1 and 5');
  });

  it('rejects rating of 0 with 400', async () => {
    const { POST } = await import('@/app/api/feedback/[token]/route');

    const request = new NextRequest('http://localhost:3000/api/feedback/valid-feedback-token', {
      method: 'POST',
      body: JSON.stringify({ rating: 0 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ token: 'valid-feedback-token' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Rating must be an integer between 1 and 5');
  });

  it('rejects rating of 6 with 400', async () => {
    const { POST } = await import('@/app/api/feedback/[token]/route');

    const request = new NextRequest('http://localhost:3000/api/feedback/valid-feedback-token', {
      method: 'POST',
      body: JSON.stringify({ rating: 6 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ token: 'valid-feedback-token' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Rating must be an integer between 1 and 5');
  });

  it('rejects negative rating of -1 with 400', async () => {
    const { POST } = await import('@/app/api/feedback/[token]/route');

    const request = new NextRequest('http://localhost:3000/api/feedback/valid-feedback-token', {
      method: 'POST',
      body: JSON.stringify({ rating: -1 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ token: 'valid-feedback-token' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Rating must be an integer between 1 and 5');
  });

  it('rejects non-numeric string "abc" with 400', async () => {
    const { POST } = await import('@/app/api/feedback/[token]/route');

    const request = new NextRequest('http://localhost:3000/api/feedback/valid-feedback-token', {
      method: 'POST',
      body: JSON.stringify({ rating: 'abc' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ token: 'valid-feedback-token' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Rating must be an integer between 1 and 5');
  });

  it('accepts valid rating of 3 and saves correctly', async () => {
    const { POST } = await import('@/app/api/feedback/[token]/route');

    const request = new NextRequest('http://localhost:3000/api/feedback/valid-feedback-token', {
      method: 'POST',
      body: JSON.stringify({
        rating: 3,
        comment: 'Decent session',
        topics_for_next_time: 'More about analytics',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ token: 'valid-feedback-token' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(feedbackCapturedUpdates.feedback_rating).toBe(3);
    expect(feedbackCapturedUpdates.feedback_comment).toBe('Decent session');
    expect(feedbackCapturedUpdates.feedback_topic_suggestion).toBe('More about analytics');
    expect(feedbackCapturedUpdates.feedback_submitted_at).toBeDefined();
  });
});

// ============================================
// TESTS: UUID Validation on Reschedule
// ============================================

describe('UUID Validation on Reschedule - PUT /api/manage/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockManageBookings = [createManageMockBooking()];
    mockManageSlots = [createManageMockSlot()];
    mockManageEvents = [createManageMockEvent()];
    mockManageAdmins = [createManageMockAdmin()];
    manageCapturedUpdates = {};
    mockSupabase = createManageMockSupabaseClient();
  });

  afterEach(() => {
    mockManageBookings = [];
    mockManageSlots = [];
    mockManageEvents = [];
    mockManageAdmins = [];
    manageCapturedUpdates = {};
  });

  it('rejects non-UUID string "not-a-uuid" with 400', async () => {
    const { PUT } = await import('@/app/api/manage/[token]/route');

    const request = new NextRequest('http://localhost:3000/api/manage/test-manage-token', {
      method: 'PUT',
      body: JSON.stringify({ new_slot_id: 'not-a-uuid' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request, { params: Promise.resolve({ token: 'test-manage-token' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid slot ID format');
  });

  it('rejects SQL injection attempt with 400', async () => {
    const { PUT } = await import('@/app/api/manage/[token]/route');

    const request = new NextRequest('http://localhost:3000/api/manage/test-manage-token', {
      method: 'PUT',
      body: JSON.stringify({ new_slot_id: "'; DROP TABLE--" }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request, { params: Promise.resolve({ token: 'test-manage-token' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid slot ID format');
  });

  it('accepts valid UUID format and proceeds with reschedule', async () => {
    const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const newSlot = createManageMockSlot({ id: validUuid });
    mockManageSlots.push(newSlot);
    mockSupabase = createManageMockSupabaseClient();

    const { PUT } = await import('@/app/api/manage/[token]/route');

    const request = new NextRequest('http://localhost:3000/api/manage/test-manage-token', {
      method: 'PUT',
      body: JSON.stringify({ new_slot_id: validUuid }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request, { params: Promise.resolve({ token: 'test-manage-token' }) });

    expect(response.status).toBe(200);
    expect(manageCapturedUpdates.slot_id).toBe(validUuid);
  });
});

// ============================================
// TESTS: Sync Availability Error Reporting
// ============================================

describe('Sync Availability Error Reporting - GET /api/cron/sync-availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncCalendarCallCount = 0;
    syncCalendarFailIndices = [];
    mockSyncAdmins = [];
    process.env.CRON_SECRET = 'test-cron-secret';
    mockSupabase = createSyncMockSupabaseClient();
  });

  afterEach(() => {
    mockSyncAdmins = [];
    syncCalendarCallCount = 0;
    syncCalendarFailIndices = [];
    delete process.env.CRON_SECRET;
  });

  it('returns 401 without valid cron secret', async () => {
    const { GET } = await import('@/app/api/cron/sync-availability/route');

    const request = new NextRequest('http://localhost:3000/api/cron/sync-availability', {
      headers: { authorization: 'Bearer wrong-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 200 with success:true when all syncs pass', async () => {
    mockSyncAdmins = [
      { id: 'admin-1', email: 'admin1@test.com', google_access_token: 'token-1', google_refresh_token: 'refresh-1' },
      { id: 'admin-2', email: 'admin2@test.com', google_access_token: 'token-2', google_refresh_token: 'refresh-2' },
      { id: 'admin-3', email: 'admin3@test.com', google_access_token: 'token-3', google_refresh_token: 'refresh-3' },
    ];
    syncCalendarFailIndices = []; // No failures
    mockSupabase = createSyncMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/sync-availability/route');

    const request = new NextRequest('http://localhost:3000/api/cron/sync-availability', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.total).toBe(3);
    expect(data.synced).toBe(3);
    expect(data.failed).toBe(0);
  });

  it('returns 200 with success:false when 1 of 3 fails (under 50%)', async () => {
    mockSyncAdmins = [
      { id: 'admin-1', email: 'admin1@test.com', google_access_token: 'token-1', google_refresh_token: 'refresh-1' },
      { id: 'admin-2', email: 'admin2@test.com', google_access_token: 'token-2', google_refresh_token: 'refresh-2' },
      { id: 'admin-3', email: 'admin3@test.com', google_access_token: 'token-3', google_refresh_token: 'refresh-3' },
    ];
    syncCalendarFailIndices = [1]; // Second admin fails
    mockSupabase = createSyncMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/sync-availability/route');

    const request = new NextRequest('http://localhost:3000/api/cron/sync-availability', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.total).toBe(3);
    expect(data.synced).toBe(2);
    expect(data.failed).toBe(1);
    expect(data.errors).toHaveLength(1);
  });

  it('returns 503 when 2 of 3 fail (over 50%)', async () => {
    mockSyncAdmins = [
      { id: 'admin-1', email: 'admin1@test.com', google_access_token: 'token-1', google_refresh_token: 'refresh-1' },
      { id: 'admin-2', email: 'admin2@test.com', google_access_token: 'token-2', google_refresh_token: 'refresh-2' },
      { id: 'admin-3', email: 'admin3@test.com', google_access_token: 'token-3', google_refresh_token: 'refresh-3' },
    ];
    syncCalendarFailIndices = [0, 2]; // First and third admins fail
    mockSupabase = createSyncMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/sync-availability/route');

    const request = new NextRequest('http://localhost:3000/api/cron/sync-availability', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.success).toBe(false);
    expect(data.total).toBe(3);
    expect(data.synced).toBe(1);
    expect(data.failed).toBe(2);
    expect(data.errors).toHaveLength(2);
    expect(data.message).toContain('Critical');
  });
});
