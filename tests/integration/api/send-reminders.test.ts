import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { addHours } from 'date-fns';

// ============================================
// MOCKS
// ============================================

const mockSendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/google', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('@/lib/email-templates', () => ({
  processTemplate: vi.fn().mockReturnValue('Reminder: Test Event'),
  createEmailVariables: vi.fn().mockReturnValue({
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    event_name: 'Test Event',
    host_name: 'Test Host',
    date: 'January 15, 2026',
    time: '2:00 PM',
    time_with_timezone: '2:00 PM CT',
    timezone: 'America/Chicago',
    timezone_abbr: 'CT',
    meet_link: 'https://meet.google.com/abc-123',
  }),
  defaultTemplates: {
    reminder_subject: 'See you {{reminder_timing}} - {{event_name}}',
    reminder_body: 'Reminder body',
  },
}));

vi.mock('@/lib/email-html', () => ({
  generateReminderEmailHtml: vi.fn().mockReturnValue('<html>Reminder</html>'),
}));

const mockGetSMSConfig = vi.fn().mockResolvedValue(null);
const mockSendSMS = vi.fn().mockResolvedValue(true);
const mockLogSMSSend = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/sms', () => ({
  getSMSConfig: (...args: unknown[]) => mockGetSMSConfig(...args),
  sendSMS: (...args: unknown[]) => mockSendSMS(...args),
  processSMSTemplate: vi.fn().mockReturnValue('SMS reminder text'),
  defaultSMSTemplates: {
    reminder_24h: 'Hi {{first_name}}, reminder tomorrow.',
    reminder_1h: 'Hi {{first_name}}, starting in 1 hour.',
  },
  logSMSSend: (...args: unknown[]) => mockLogSMSSend(...args),
}));

vi.mock('@/lib/logger', () => ({
  cronLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
  emailLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
  smsLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

// ============================================
// Supabase mock
// ============================================

let mockSlots: Record<string, unknown>[] = [];
let mockAdmin: Record<string, unknown> | null = null;
let mockUpdateCalls: { table: string; data: Record<string, unknown>; id: string }[] = [];

function createMockSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'oh_slots') {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.gte = vi.fn().mockReturnValue(chain);
        chain.lte = vi.fn().mockReturnValue(chain);
        // The terminal await resolves the chain as a thenable
        chain.then = (resolve: (val: unknown) => void) => {
          resolve({ data: mockSlots, error: null });
          return Promise.resolve({ data: mockSlots, error: null });
        };
        return chain;
      }

      if (table === 'oh_admins') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAdmin,
                error: mockAdmin ? null : { message: 'Not found' },
              }),
            }),
          }),
        };
      }

      if (table === 'oh_bookings') {
        return {
          update: vi.fn().mockImplementation((data: Record<string, unknown>) => ({
            eq: vi.fn().mockImplementation((_field: string, value: string) => {
              mockUpdateCalls.push({ table: 'oh_bookings', data, id: value });
              return Promise.resolve({ data: null, error: null });
            }),
          })),
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

function createMockBooking(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'booking-1',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone: null,
    sms_consent: false,
    manage_token: 'manage-token-123',
    attendee_timezone: 'America/Chicago',
    reminder_24h_sent_at: null,
    reminder_1h_sent_at: null,
    sms_reminder_24h_sent_at: null,
    sms_reminder_1h_sent_at: null,
    cancelled_at: null,
    assigned_host: null,
    ...overrides,
  };
}

function createMockEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'event-1',
    name: 'Test Event',
    host_email: 'host@test.com',
    host_name: 'Test Host',
    display_timezone: 'America/Chicago',
    meeting_type: 'one_on_one',
    reminder_subject: null,
    sms_reminders_enabled: false,
    sms_reminder_24h_template: null,
    sms_reminder_1h_template: null,
    ...overrides,
  };
}

function createMockSlot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'slot-1',
    event_id: 'event-1',
    start_time: addHours(new Date(), 24).toISOString(),
    end_time: addHours(new Date(), 25).toISOString(),
    is_cancelled: false,
    google_meet_link: 'https://meet.google.com/abc-123',
    event: createMockEvent(),
    bookings: [createMockBooking()],
    ...overrides,
  };
}

function createMockAdmin(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'admin-1',
    email: 'host@test.com',
    name: 'Test Host',
    google_access_token: 'access-token',
    google_refresh_token: 'refresh-token',
    ...overrides,
  };
}

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/send-reminders', {
    method: 'GET',
    headers,
  });
}

// ============================================
// TESTS
// ============================================

describe('GET /api/cron/send-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    vi.stubEnv('CRON_SECRET', '');
    mockSlots = [];
    mockAdmin = createMockAdmin();
    mockUpdateCalls = [];
    mockSupabase = createMockSupabaseClient();
    mockGetSMSConfig.mockResolvedValue(null);
    mockSendEmail.mockResolvedValue(undefined);
    mockSendSMS.mockResolvedValue(true);
  });

  // -------------------------------------------
  // Auth tests
  // -------------------------------------------

  it('returns 401 when CRON_SECRET is set and auth header does not match', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret');
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({ authorization: 'Bearer wrong-secret' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('allows request when CRON_SECRET is set and auth header matches', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret');
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({ authorization: 'Bearer my-secret' });
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it('allows request when CRON_SECRET is not set (no auth required)', async () => {
    vi.stubEnv('CRON_SECRET', '');
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  // -------------------------------------------
  // 24h reminder tests
  // -------------------------------------------

  it('sends 24h email reminder for booking in slot 24 hours from now', async () => {
    const slotTime = addHours(new Date(), 24.5); // 24.5h from now (within 23-25h window)
    mockSlots = [
      createMockSlot({
        start_time: slotTime.toISOString(),
        bookings: [createMockBooking()],
      }),
    ];
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.emailRemindersSent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // Verify the booking was updated with reminder_24h_sent_at
    expect(mockUpdateCalls.length).toBeGreaterThanOrEqual(1);
    const emailUpdate = mockUpdateCalls.find(
      (c) => c.table === 'oh_bookings' && c.data.reminder_24h_sent_at
    );
    expect(emailUpdate).toBeTruthy();
  });

  it('skips 24h reminder if already sent (reminder_24h_sent_at is set)', async () => {
    const slotTime = addHours(new Date(), 24.5);
    mockSlots = [
      createMockSlot({
        start_time: slotTime.toISOString(),
        bookings: [
          createMockBooking({ reminder_24h_sent_at: new Date().toISOString() }),
        ],
      }),
    ];
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.emailRemindersSent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // -------------------------------------------
  // 1h reminder tests
  // -------------------------------------------

  it('sends 1h email reminder for booking in slot 1 hour from now', async () => {
    const slotTime = addHours(new Date(), 1); // 1h from now (within 0.5-1.5h window)
    mockSlots = [
      createMockSlot({
        start_time: slotTime.toISOString(),
        bookings: [createMockBooking()],
      }),
    ];
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.emailRemindersSent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // Verify booking updated with reminder_1h_sent_at
    const emailUpdate = mockUpdateCalls.find(
      (c) => c.table === 'oh_bookings' && c.data.reminder_1h_sent_at
    );
    expect(emailUpdate).toBeTruthy();
  });

  it('skips 1h reminder if already sent (reminder_1h_sent_at is set)', async () => {
    const slotTime = addHours(new Date(), 1);
    mockSlots = [
      createMockSlot({
        start_time: slotTime.toISOString(),
        bookings: [
          createMockBooking({ reminder_1h_sent_at: new Date().toISOString() }),
        ],
      }),
    ];
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.emailRemindersSent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // -------------------------------------------
  // Cancelled booking tests
  // -------------------------------------------

  it('skips cancelled bookings', async () => {
    const slotTime = addHours(new Date(), 24.5);
    mockSlots = [
      createMockSlot({
        start_time: slotTime.toISOString(),
        bookings: [
          createMockBooking({ cancelled_at: new Date().toISOString() }),
        ],
      }),
    ];
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.emailRemindersSent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // -------------------------------------------
  // Missing admin tokens tests
  // -------------------------------------------

  it('skips slots where host has no Google tokens', async () => {
    const slotTime = addHours(new Date(), 24.5);
    mockSlots = [
      createMockSlot({
        start_time: slotTime.toISOString(),
        bookings: [createMockBooking()],
      }),
    ];
    mockAdmin = createMockAdmin({
      google_access_token: null,
      google_refresh_token: null,
    });
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.emailRemindersSent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // -------------------------------------------
  // SMS reminder tests
  // -------------------------------------------

  it('sends SMS reminder when SMS is fully configured', async () => {
    const slotTime = addHours(new Date(), 24.5);
    mockSlots = [
      createMockSlot({
        start_time: slotTime.toISOString(),
        event: createMockEvent({ sms_reminders_enabled: true }),
        bookings: [
          createMockBooking({
            phone: '+15551234567',
            sms_consent: true,
          }),
        ],
      }),
    ];
    mockGetSMSConfig.mockResolvedValue({ is_active: true, provider: 'twilio' });
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.emailRemindersSent).toBe(1);
    expect(data.smsRemindersSent).toBe(1);
    expect(mockSendSMS).toHaveBeenCalledWith('+15551234567', expect.any(String));
    expect(mockLogSMSSend).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        status: 'sent',
        messageType: 'reminder_24h',
      })
    );
  });

  it('skips SMS when SMS config is not active', async () => {
    const slotTime = addHours(new Date(), 24.5);
    mockSlots = [
      createMockSlot({
        start_time: slotTime.toISOString(),
        event: createMockEvent({ sms_reminders_enabled: true }),
        bookings: [
          createMockBooking({
            phone: '+15551234567',
            sms_consent: true,
          }),
        ],
      }),
    ];
    mockGetSMSConfig.mockResolvedValue(null); // SMS not configured
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.smsRemindersSent).toBe(0);
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it('skips SMS when booking has no phone or no sms_consent', async () => {
    const slotTime = addHours(new Date(), 24.5);
    mockSlots = [
      createMockSlot({
        start_time: slotTime.toISOString(),
        event: createMockEvent({ sms_reminders_enabled: true }),
        bookings: [
          createMockBooking({ phone: null, sms_consent: false }),
        ],
      }),
    ];
    mockGetSMSConfig.mockResolvedValue({ is_active: true, provider: 'twilio' });
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.smsRemindersSent).toBe(0);
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  // -------------------------------------------
  // Critical failure detection
  // -------------------------------------------

  it('returns 500 when more than 50% of reminders fail', async () => {
    const slotTime = addHours(new Date(), 24.5);
    // Create 4 bookings, all will fail
    const bookings = Array.from({ length: 4 }, (_, i) =>
      createMockBooking({ id: `booking-${i}`, email: `user${i}@example.com` })
    );
    mockSlots = [
      createMockSlot({
        start_time: slotTime.toISOString(),
        bookings,
      }),
    ];
    mockSendEmail.mockRejectedValue(new Error('Gmail API error'));
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.errors.length).toBe(4);
    expect(data.message).toContain('Critical');
  });

  // -------------------------------------------
  // MAX_REMINDERS_PER_RUN cap
  // -------------------------------------------

  it('caps reminders at MAX_REMINDERS_PER_RUN (100)', async () => {
    const slotTime = addHours(new Date(), 24.5);
    // Create 105 bookings
    const bookings = Array.from({ length: 105 }, (_, i) =>
      createMockBooking({ id: `booking-${i}`, email: `user${i}@example.com` })
    );
    mockSlots = [
      createMockSlot({
        start_time: slotTime.toISOString(),
        bookings,
      }),
    ];
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should be capped at 100, not 105
    expect(data.emailRemindersSent).toBeLessThanOrEqual(100);
    expect(mockSendEmail).toHaveBeenCalledTimes(100);
  });

  // -------------------------------------------
  // No slots / empty results
  // -------------------------------------------

  it('returns success with zero reminders when no slots are in the time window', async () => {
    mockSlots = [];
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.emailRemindersSent).toBe(0);
    expect(data.smsRemindersSent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // -------------------------------------------
  // Slots query error
  // -------------------------------------------

  it('returns 500 when the slots query fails', async () => {
    // Override the mock to return an error
    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'oh_slots') {
          const chain: Record<string, unknown> = {};
          chain.select = vi.fn().mockReturnValue(chain);
          chain.eq = vi.fn().mockReturnValue(chain);
          chain.gte = vi.fn().mockReturnValue(chain);
          chain.lte = vi.fn().mockReturnValue(chain);
          chain.then = (resolve: (val: unknown) => void) => {
            resolve({ data: null, error: { message: 'Database error' } });
            return Promise.resolve({ data: null, error: { message: 'Database error' } });
          };
          return chain;
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

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch slots');
  });

  // -------------------------------------------
  // Partial failures (some succeed, some fail, not critical)
  // -------------------------------------------

  it('returns success with errors when fewer than 50% of reminders fail', async () => {
    const slotTime = addHours(new Date(), 24.5);
    // 3 bookings: 2 will succeed, 1 will fail (33% failure rate - below 50% threshold)
    const bookings = [
      createMockBooking({ id: 'booking-0', email: 'success1@example.com' }),
      createMockBooking({ id: 'booking-1', email: 'fail@example.com' }),
      createMockBooking({ id: 'booking-2', email: 'success2@example.com' }),
    ];
    mockSlots = [
      createMockSlot({
        start_time: slotTime.toISOString(),
        bookings,
      }),
    ];
    // First call succeeds, second fails, third succeeds
    mockSendEmail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Send failed'))
      .mockResolvedValueOnce(undefined);
    mockSupabase = createMockSupabaseClient();

    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(false); // success is false because there are errors
    expect(data.emailRemindersSent).toBe(2);
    expect(data.errors).toHaveLength(1);
  });
});
