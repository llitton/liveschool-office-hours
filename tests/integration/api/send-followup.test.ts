import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Send Follow-up API Integration Tests
 *
 * Tests the /api/slots/[id]/send-followup endpoint which sends
 * bulk follow-up emails to attendees or no-shows.
 */

// ============================================
// MOCK SETUP
// ============================================

let mockSession: { email: string } | null = null;
let mockSlot: Record<string, unknown> | null = null;
let mockAdmin: Record<string, unknown> | null = null;
let capturedUpdates: Record<string, unknown>[] = [];
let sendEmailCalls: unknown[] = [];

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(async () => mockSession),
}));

vi.mock('@/lib/google', () => ({
  sendEmail: vi.fn(async () => {
    sendEmailCalls.push({});
    return { messageId: 'msg-123', threadId: 'thread-123' };
  }),
}));

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'oh_slots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockSlot,
                error: mockSlot ? null : { message: 'Not found' },
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
                data: mockAdmin,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'oh_bookings') {
        return {
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockImplementation((field, ids) => {
              capturedUpdates.push({ field, ids });
              return Promise.resolve({ error: null });
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
  })),
}));

// ============================================
// TEST HELPERS
// ============================================

function createMockSlot(bookings: Record<string, unknown>[]) {
  return {
    id: 'slot-123',
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 3600000).toISOString(),
    event: {
      id: 'event-123',
      name: 'Test Event',
      host_email: 'host@test.com',
    },
    bookings,
  };
}

function createMockBooking(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: `booking-${Math.random().toString(36).slice(2)}`,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    cancelled_at: null,
    attended_at: null,
    no_show_at: null,
    ...overrides,
  };
}

// ============================================
// TESTS
// ============================================

describe('Send Follow-up API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { email: 'sender@test.com' };
    mockAdmin = {
      id: 'admin-123',
      email: 'sender@test.com',
      google_access_token: 'token',
      google_refresh_token: 'refresh',
    };
    mockSlot = null;
    capturedUpdates = [];
    sendEmailCalls = [];
  });

  describe('POST /api/slots/[id]/send-followup', () => {
    it('returns 401 when not authenticated', async () => {
      mockSession = null;
      vi.resetModules();

      const { POST } = await import('@/app/api/slots/[id]/send-followup/route');
      const request = new Request('http://localhost/api/slots/slot-123/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: 'attended',
          subject: 'Test',
          body: 'Test body',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'slot-123' }) });
      expect(response.status).toBe(401);
    });

    it('returns 400 when missing required fields', async () => {
      vi.resetModules();

      const { POST } = await import('@/app/api/slots/[id]/send-followup/route');
      const request = new Request('http://localhost/api/slots/slot-123/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: 'attended' }), // Missing subject and body
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'slot-123' }) });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('required');
    });

    it('returns 400 when invalid recipients type', async () => {
      vi.resetModules();

      const { POST } = await import('@/app/api/slots/[id]/send-followup/route');
      const request = new Request('http://localhost/api/slots/slot-123/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: 'invalid',
          subject: 'Test',
          body: 'Test body',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'slot-123' }) });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('attended');
    });

    it('returns 404 when slot not found', async () => {
      mockSlot = null;
      vi.resetModules();

      const { POST } = await import('@/app/api/slots/[id]/send-followup/route');
      const request = new Request('http://localhost/api/slots/slot-123/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: 'attended',
          subject: 'Test',
          body: 'Test body',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'slot-123' }) });
      expect(response.status).toBe(404);
    });

    it('returns 400 when no attendees to email', async () => {
      mockSlot = createMockSlot([
        createMockBooking({ attended_at: null, no_show_at: null }), // Not marked
      ]);
      vi.resetModules();

      const { POST } = await import('@/app/api/slots/[id]/send-followup/route');
      const request = new Request('http://localhost/api/slots/slot-123/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: 'attended',
          subject: 'Test',
          body: 'Test body',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'slot-123' }) });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No');
    });

    it('returns 400 when sender has no Google credentials', async () => {
      mockSlot = createMockSlot([
        createMockBooking({ attended_at: new Date().toISOString() }),
      ]);
      mockAdmin = { ...mockAdmin, google_access_token: null, google_refresh_token: null };
      vi.resetModules();

      const { POST } = await import('@/app/api/slots/[id]/send-followup/route');
      const request = new Request('http://localhost/api/slots/slot-123/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: 'attended',
          subject: 'Test',
          body: 'Test body',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'slot-123' }) });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Google');
    });

    it('sends emails to attended bookings and returns sentFrom', async () => {
      const booking1 = createMockBooking({ id: 'b1', attended_at: new Date().toISOString() });
      const booking2 = createMockBooking({ id: 'b2', attended_at: new Date().toISOString(), email: 'jane@example.com' });
      mockSlot = createMockSlot([booking1, booking2]);
      vi.resetModules();

      const { POST } = await import('@/app/api/slots/[id]/send-followup/route');
      const request = new Request('http://localhost/api/slots/slot-123/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: 'attended',
          subject: 'Thanks!',
          body: 'Thanks for attending!',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'slot-123' }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.sent).toBe(2);
      expect(data.sentFrom).toBe('sender@test.com');
    });

    it('sends emails to no-show bookings', async () => {
      const booking1 = createMockBooking({ id: 'b1', no_show_at: new Date().toISOString() });
      mockSlot = createMockSlot([booking1]);
      vi.resetModules();

      const { POST } = await import('@/app/api/slots/[id]/send-followup/route');
      const request = new Request('http://localhost/api/slots/slot-123/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: 'no_show',
          subject: 'We missed you!',
          body: 'Sorry you missed it.',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'slot-123' }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.sent).toBe(1);
    });

    it('skips cancelled bookings', async () => {
      const booking1 = createMockBooking({ attended_at: new Date().toISOString() });
      const booking2 = createMockBooking({
        attended_at: new Date().toISOString(),
        cancelled_at: new Date().toISOString(),
      });
      mockSlot = createMockSlot([booking1, booking2]);
      vi.resetModules();

      const { POST } = await import('@/app/api/slots/[id]/send-followup/route');
      const request = new Request('http://localhost/api/slots/slot-123/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: 'attended',
          subject: 'Thanks!',
          body: 'Thanks!',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'slot-123' }) });
      const data = await response.json();
      expect(data.sent).toBe(1); // Only non-cancelled booking
    });

    it('replaces {{first_name}} placeholder in email body', async () => {
      const booking = createMockBooking({ id: 'b1', first_name: 'Alice', attended_at: new Date().toISOString() });
      mockSlot = createMockSlot([booking]);

      // Clear the mock to capture new calls
      const { sendEmail } = await import('@/lib/google');
      vi.mocked(sendEmail).mockClear();
      vi.resetModules();

      const { POST } = await import('@/app/api/slots/[id]/send-followup/route');
      const request = new Request('http://localhost/api/slots/slot-123/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: 'attended',
          subject: 'Hi {{first_name}}!',
          body: 'Hello {{first_name}}, thanks for joining!',
        }),
      });

      await POST(request, { params: Promise.resolve({ id: 'slot-123' }) });

      // Verify sendEmail was called with personalized body
      expect(sendEmail).toHaveBeenCalled();
      const call = vi.mocked(sendEmail).mock.calls[0];
      expect(call[2].htmlBody).toContain('Alice');
    });
  });
});
