import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================
// MOCKS
// ============================================

let mockBookings: Record<string, unknown>[] = [];
let mockSlots: Record<string, unknown>[] = [];
let mockEvents: Record<string, unknown>[] = [];
let mockAdmins: Record<string, unknown>[] = [];
let mockEventHosts: Record<string, unknown>[] = [];

vi.mock('crypto', () => ({
  default: {
    randomBytes: () => ({
      toString: () => 'mock-manage-token-12345',
    }),
  },
}));

vi.mock('@/lib/google', () => ({
  addAttendeeToEvent: vi.fn().mockResolvedValue(undefined),
  removeAttendeeFromEvent: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/hubspot', () => ({
  updateMeetingOutcome: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ email: 'host@test.com' }),
}));

vi.mock('@/lib/email-html', () => ({
  generateConfirmationEmailHtml: vi.fn().mockReturnValue('<html>Confirmation</html>'),
  generateCancellationEmailHtml: vi.fn().mockReturnValue('<html>Cancellation</html>'),
  escapeHtml: vi.fn((str: string) => str),
}));

vi.mock('@/lib/email-templates', () => ({
  createEmailVariables: vi.fn().mockReturnValue({
    date: 'Monday, February 3',
    time: '2:00 PM',
    timezone_abbr: 'CT',
    timezone: 'Central Time',
    host_name: 'Test Host',
  }),
}));

vi.mock('@/lib/ical', () => ({
  generateGoogleCalendarUrl: vi.fn().mockReturnValue('https://calendar.google.com/test'),
  generateOutlookUrl: vi.fn().mockReturnValue('https://outlook.live.com/test'),
}));

vi.mock('@/lib/logger', () => ({
  bookingLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  calendarLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/timezone', () => ({
  getTimezoneAbbr: vi.fn().mockReturnValue('CT'),
}));

vi.mock('@/lib/errors', () => ({
  CommonErrors: {
    UNAUTHORIZED: 'You must be logged in',
    NOT_FOUND: 'Not found',
    SERVER_ERROR: 'Something went wrong',
  },
  getUserFriendlyError: vi.fn((err: { message?: string }) => err?.message || 'Database error'),
  safeParseJSON: vi.fn(async (req: Request) => {
    try {
      return await req.json();
    } catch {
      return null;
    }
  }),
}));

// Mock Supabase
function createMockSupabaseClient() {
  const createChainableMock = (finalResult: unknown) => {
    const chain: Record<string, unknown> = {};
    const methods = ['select', 'eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'is', 'in', 'order', 'limit'];
    methods.forEach((method) => {
      chain[method] = vi.fn().mockReturnValue(chain);
    });
    chain.single = vi.fn().mockResolvedValue(finalResult);
    return chain;
  };

  return {
    rpc: vi.fn().mockImplementation((_funcName: string, params: Record<string, unknown>) => {
      // Check duplicate
      const existing = mockBookings.find(
        (b) =>
          b.slot_id === params.p_slot_id &&
          (b.email as string).toLowerCase() === (params.p_email as string).toLowerCase() &&
          !b.cancelled_at
      );
      if (existing) {
        return Promise.resolve({
          data: { success: false, error: 'You have already booked this time slot', error_code: 'DUPLICATE_BOOKING' },
          error: null,
        });
      }

      // Check capacity
      const event = mockEvents[0] as { max_attendees: number; waitlist_enabled?: boolean };
      const confirmedCount = mockBookings.filter(
        (b) => b.slot_id === params.p_slot_id && !b.cancelled_at && !b.is_waitlisted
      ).length;

      if (confirmedCount >= event.max_attendees) {
        if (!event.waitlist_enabled) {
          return Promise.resolve({
            data: { success: false, error: 'This time slot is full', error_code: 'SLOT_FULL' },
            error: null,
          });
        }
      }

      const newBooking = {
        id: `booking-${Date.now()}`,
        slot_id: params.p_slot_id,
        first_name: params.p_first_name,
        last_name: params.p_last_name,
        email: (params.p_email as string).toLowerCase(),
        manage_token: params.p_manage_token,
        cancelled_at: null,
        is_waitlisted: false,
        created_at: new Date().toISOString(),
      };
      mockBookings.push(newBooking);

      return Promise.resolve({
        data: { success: true, booking_id: newBooking.id, is_waitlisted: false },
        error: null,
      });
    }),
    from: vi.fn((table: string) => {
      if (table === 'oh_slots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(async () => {
                const slot = mockSlots[0];
                if (!slot) return { data: null, error: { message: 'Not found' } };
                return { data: { ...slot, event: mockEvents[0] }, error: null };
              }),
            }),
          }),
        };
      }

      if (table === 'oh_bookings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_field: string, value: unknown) => ({
              single: vi.fn().mockImplementation(async () => {
                const booking = mockBookings.find((b) => b.id === value);
                if (!booking) return { data: null, error: { code: 'PGRST116' } };
                const slot = mockSlots[0];
                return {
                  data: {
                    ...booking,
                    slot: { ...slot, event: mockEvents[0] },
                    assigned_host: null,
                  },
                  error: null,
                };
              }),
            })),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              then: (resolve: (val: unknown) => void) => {
                resolve({ data: null, error: null });
                return Promise.resolve({ data: null, error: null });
              },
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_field: string, value: unknown) => {
              const idx = mockBookings.findIndex((b) => b.id === value);
              if (idx !== -1) mockBookings.splice(idx, 1);
              return Promise.resolve({ data: null, error: null });
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

      if (table === 'oh_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockImplementation(async () => {
                  const event = mockEvents[0];
                  return { data: event || null, error: event ? null : { code: 'PGRST116' } };
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'oh_event_hosts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockEventHosts[0] || null,
                  error: mockEventHosts[0] ? null : { code: 'PGRST116' },
                }),
              }),
            }),
          }),
        };
      }

      return createChainableMock({ data: null, error: null });
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

const TEST_SLOT_ID = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
const TEST_EVENT_ID = 'f1e2d3c4-b5a6-4987-8765-432109876543';

function createMockEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TEST_EVENT_ID,
    slug: 'test-event',
    name: 'Test Event',
    host_name: 'Test Host',
    host_email: 'host@test.com',
    max_attendees: 5,
    timezone: 'America/Chicago',
    display_timezone: 'America/Chicago',
    description: 'Test description',
    waitlist_enabled: false,
    ...overrides,
  };
}

function createMockSlot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TEST_SLOT_ID,
    event_id: TEST_EVENT_ID,
    start_time: '2026-02-04T14:00:00.000Z',
    end_time: '2026-02-04T15:00:00.000Z',
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
    id: 'booking-existing',
    slot_id: TEST_SLOT_ID,
    first_name: 'Existing',
    last_name: 'User',
    email: 'existing@test.com',
    manage_token: 'existing-token',
    cancelled_at: null,
    is_waitlisted: false,
    hubspot_contact_id: null,
    ...overrides,
  };
}

// ============================================
// TESTS
// ============================================

describe('Attendee Management API', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBookings = [];
    mockSlots = [createMockSlot()];
    mockEvents = [createMockEvent()];
    mockAdmins = [createMockAdmin()];
    mockEventHosts = [];
    mockSupabase = createMockSupabaseClient();
  });

  afterEach(() => {
    mockBookings = [];
    mockSlots = [];
    mockEvents = [];
    mockAdmins = [];
    mockEventHosts = [];
  });

  // ==========================================
  // DELETE /api/bookings/[id] - Remove Attendee
  // ==========================================
  describe('DELETE /api/bookings/[id] - Remove Attendee', () => {
    it('permanently deletes a booking', async () => {
      const booking = createMockBooking();
      mockBookings = [booking];
      mockSupabase = createMockSupabaseClient();

      const { DELETE } = await import('@/app/api/bookings/[id]/route');

      const request = new NextRequest('http://localhost:3000/api/bookings/booking-existing', {
        method: 'DELETE',
        body: JSON.stringify({ notify: false }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'booking-existing' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('removes attendee from Google Calendar', async () => {
      const { removeAttendeeFromEvent } = await import('@/lib/google');
      const booking = createMockBooking();
      mockBookings = [booking];
      mockSupabase = createMockSupabaseClient();

      const { DELETE } = await import('@/app/api/bookings/[id]/route');

      const request = new NextRequest('http://localhost:3000/api/bookings/booking-existing', {
        method: 'DELETE',
        body: JSON.stringify({ notify: false }),
        headers: { 'Content-Type': 'application/json' },
      });

      await DELETE(request, { params: Promise.resolve({ id: 'booking-existing' }) });

      expect(removeAttendeeFromEvent).toHaveBeenCalledWith(
        'mock-token',
        'mock-refresh',
        'gcal-123',
        'existing@test.com'
      );
    });

    it('sends cancellation email when notify is true', async () => {
      const { sendEmail } = await import('@/lib/google');
      const booking = createMockBooking();
      mockBookings = [booking];
      mockSupabase = createMockSupabaseClient();

      const { DELETE } = await import('@/app/api/bookings/[id]/route');

      const request = new NextRequest('http://localhost:3000/api/bookings/booking-existing', {
        method: 'DELETE',
        body: JSON.stringify({ notify: true }),
        headers: { 'Content-Type': 'application/json' },
      });

      await DELETE(request, { params: Promise.resolve({ id: 'booking-existing' }) });

      expect(sendEmail).toHaveBeenCalled();
    });

    it('skips email when notify is false', async () => {
      const { sendEmail } = await import('@/lib/google');
      const booking = createMockBooking();
      mockBookings = [booking];
      mockSupabase = createMockSupabaseClient();

      const { DELETE } = await import('@/app/api/bookings/[id]/route');

      const request = new NextRequest('http://localhost:3000/api/bookings/booking-existing', {
        method: 'DELETE',
        body: JSON.stringify({ notify: false }),
        headers: { 'Content-Type': 'application/json' },
      });

      await DELETE(request, { params: Promise.resolve({ id: 'booking-existing' }) });

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
      const { getSession } = await import('@/lib/auth');
      vi.mocked(getSession).mockResolvedValueOnce(null);

      const { DELETE } = await import('@/app/api/bookings/[id]/route');

      const request = new NextRequest('http://localhost:3000/api/bookings/booking-existing', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'booking-existing' }) });
      expect(response.status).toBe(401);
    });

    it('returns 404 when booking not found', async () => {
      mockBookings = [];
      mockSupabase = createMockSupabaseClient();

      const { DELETE } = await import('@/app/api/bookings/[id]/route');

      const request = new NextRequest('http://localhost:3000/api/bookings/nonexistent', {
        method: 'DELETE',
        body: JSON.stringify({ notify: false }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      expect(response.status).toBe(404);
    });

    it('syncs cancellation to HubSpot when contact exists', async () => {
      const { updateMeetingOutcome } = await import('@/lib/hubspot');
      const booking = createMockBooking({ hubspot_contact_id: 'hs-contact-456' });
      mockBookings = [booking];
      mockSupabase = createMockSupabaseClient();

      const { DELETE } = await import('@/app/api/bookings/[id]/route');

      const request = new NextRequest('http://localhost:3000/api/bookings/booking-existing', {
        method: 'DELETE',
        body: JSON.stringify({ notify: false }),
        headers: { 'Content-Type': 'application/json' },
      });

      await DELETE(request, { params: Promise.resolve({ id: 'booking-existing' }) });

      expect(updateMeetingOutcome).toHaveBeenCalledWith(
        'hs-contact-456',
        'Test Event',
        'CANCELED',
        'Removed by admin'
      );
    });
  });

  // ==========================================
  // POST /api/slots/[id]/add-attendee
  // ==========================================
  describe('POST /api/slots/[id]/add-attendee - Add Attendee', () => {
    it('creates a booking for the slot', async () => {
      const { POST } = await import('@/app/api/slots/[id]/add-attendee/route');

      const request = new NextRequest(`http://localhost:3000/api/slots/${TEST_SLOT_ID}/add-attendee`, {
        method: 'POST',
        body: JSON.stringify({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          notify: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.booking_id).toBeTruthy();
      expect(data.is_waitlisted).toBe(false);
    });

    it('adds attendee to Google Calendar', async () => {
      const { addAttendeeToEvent } = await import('@/lib/google');

      const { POST } = await import('@/app/api/slots/[id]/add-attendee/route');

      const request = new NextRequest(`http://localhost:3000/api/slots/${TEST_SLOT_ID}/add-attendee`, {
        method: 'POST',
        body: JSON.stringify({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          notify: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });

      expect(addAttendeeToEvent).toHaveBeenCalledWith(
        'mock-token',
        'mock-refresh',
        'gcal-123',
        'jane@example.com'
      );
    });

    it('sends confirmation email when notify is true', async () => {
      const { sendEmail } = await import('@/lib/google');

      const { POST } = await import('@/app/api/slots/[id]/add-attendee/route');

      const request = new NextRequest(`http://localhost:3000/api/slots/${TEST_SLOT_ID}/add-attendee`, {
        method: 'POST',
        body: JSON.stringify({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          notify: true,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });

      expect(sendEmail).toHaveBeenCalled();
    });

    it('skips email when notify is false', async () => {
      const { sendEmail } = await import('@/lib/google');

      const { POST } = await import('@/app/api/slots/[id]/add-attendee/route');

      const request = new NextRequest(`http://localhost:3000/api/slots/${TEST_SLOT_ID}/add-attendee`, {
        method: 'POST',
        body: JSON.stringify({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          notify: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('rejects duplicate attendee on same slot', async () => {
      mockBookings = [createMockBooking({ email: 'jane@example.com' })];
      mockSupabase = createMockSupabaseClient();

      const { POST } = await import('@/app/api/slots/[id]/add-attendee/route');

      const request = new NextRequest(`http://localhost:3000/api/slots/${TEST_SLOT_ID}/add-attendee`, {
        method: 'POST',
        body: JSON.stringify({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          notify: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('already booked');
    });

    it('rejects missing required fields', async () => {
      const { POST } = await import('@/app/api/slots/[id]/add-attendee/route');

      const request = new NextRequest(`http://localhost:3000/api/slots/${TEST_SLOT_ID}/add-attendee`, {
        method: 'POST',
        body: JSON.stringify({ first_name: 'Jane' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('rejects invalid email format', async () => {
      const { POST } = await import('@/app/api/slots/[id]/add-attendee/route');

      const request = new NextRequest(`http://localhost:3000/api/slots/${TEST_SLOT_ID}/add-attendee`, {
        method: 'POST',
        body: JSON.stringify({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'not-an-email',
          notify: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid email');
    });

    it('returns 401 when not authenticated', async () => {
      const { getSession } = await import('@/lib/auth');
      vi.mocked(getSession).mockResolvedValueOnce(null);

      const { POST } = await import('@/app/api/slots/[id]/add-attendee/route');

      const request = new NextRequest(`http://localhost:3000/api/slots/${TEST_SLOT_ID}/add-attendee`, {
        method: 'POST',
        body: JSON.stringify({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          notify: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });
      expect(response.status).toBe(401);
    });

    it('returns 404 when slot not found', async () => {
      mockSlots = [];
      mockSupabase = createMockSupabaseClient();

      const { POST } = await import('@/app/api/slots/[id]/add-attendee/route');

      const request = new NextRequest('http://localhost:3000/api/slots/nonexistent/add-attendee', {
        method: 'POST',
        body: JSON.stringify({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          notify: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      expect(response.status).toBe(404);
    });
  });
});
