import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================
// MOCKS
// ============================================

let mockSlot: Record<string, unknown> | null = null;
let mockEvent: Record<string, unknown> | null = null;
let mockAdmin: Record<string, unknown> | null = null;
let mockBookings: Record<string, unknown>[] = [];
let deletedSlotIds: string[] = [];
let deletedBookingSlotIds: string[] = [];
let updatedSlots: Record<string, unknown>[] = [];

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ email: 'host@test.com' }),
}));

vi.mock('@/lib/google', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/email-templates', () => ({
  processTemplate: vi.fn().mockReturnValue('Processed template'),
  createEmailVariables: vi.fn().mockReturnValue({}),
  defaultTemplates: {
    cancellation_subject: 'Cancelled: {{event_name}}',
    cancellation_body: 'Your session has been cancelled.',
  },
  htmlifyEmailBody: vi.fn((text: string) => `<p>${text}</p>`),
}));

vi.mock('@/lib/errors', () => ({
  CommonErrors: {
    UNAUTHORIZED: 'You must be logged in',
    NOT_FOUND: 'Not found',
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

vi.mock('@/lib/logger', () => ({
  slotLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: () => createMockSupabase(),
}));

function createMockSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'oh_slots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(async () => {
                if (!mockSlot) return { data: null, error: { message: 'Not found' } };
                return {
                  data: {
                    ...mockSlot,
                    event: mockEvent,
                    bookings: mockBookings,
                  },
                  error: null,
                };
              }),
            }),
          }),
          update: vi.fn().mockImplementation((updates: Record<string, unknown>) => ({
            eq: vi.fn().mockImplementation((_field: string, id: string) => {
              updatedSlots.push({ id, ...updates });
              return Promise.resolve({ data: null, error: null });
            }),
          })),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_field: string, id: string) => {
              deletedSlotIds.push(id);
              return Promise.resolve({ data: null, error: null });
            }),
          }),
        };
      }

      if (table === 'oh_bookings') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_field: string, slotId: string) => {
              deletedBookingSlotIds.push(slotId);
              return Promise.resolve({ data: null, error: null });
            }),
          }),
        };
      }

      if (table === 'oh_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_field: string, _value: unknown) => ({
              eq: vi.fn().mockImplementation((field2: string, value2: unknown) => ({
                single: vi.fn().mockImplementation(async () => {
                  // Simulate host_email filter
                  if (field2 === 'host_email' && mockEvent && mockEvent.host_email !== value2) {
                    return { data: null, error: { code: 'PGRST116' } };
                  }
                  return {
                    data: mockEvent ? { id: mockEvent.id } : null,
                    error: mockEvent ? null : { code: 'PGRST116' },
                  };
                }),
              })),
            })),
          }),
        };
      }

      if (table === 'oh_admins') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAdmin,
                error: mockAdmin ? null : { code: 'PGRST116' },
              }),
            }),
          }),
        };
      }

      // Default fallback for oh_event_hosts and other tables
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    }),
  };
}

const TEST_SLOT_ID = 'slot-abc-123';
const TEST_EVENT_ID = 'event-def-456';

// ============================================
// TESTS
// ============================================

describe('DELETE /api/slots/[id] - Slot Deletion', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deletedSlotIds = [];
    deletedBookingSlotIds = [];
    updatedSlots = [];

    mockEvent = {
      id: TEST_EVENT_ID,
      name: 'Test Event',
      host_email: 'host@test.com',
      meeting_type: 'one_on_one',
      display_timezone: 'America/Chicago',
    };

    mockSlot = {
      id: TEST_SLOT_ID,
      event_id: TEST_EVENT_ID,
      start_time: '2026-01-23T15:00:00.000Z',
      end_time: '2026-01-23T15:30:00.000Z',
      is_cancelled: false,
      google_event_id: 'gcal-456',
    };

    mockAdmin = {
      id: 'admin-1',
      email: 'host@test.com',
      name: 'Test Host',
      google_access_token: 'token',
      google_refresh_token: 'refresh',
    };

    mockBookings = [];
  });

  describe('Permanent deletion (?permanent=true)', () => {
    it('permanently deletes slot and bookings', async () => {
      mockBookings = [
        { id: 'b1', email: 'a@test.com', first_name: 'A', last_name: 'B', cancelled_at: null },
        { id: 'b2', email: 'c@test.com', first_name: 'C', last_name: 'D', cancelled_at: null },
      ];

      const { DELETE } = await import('@/app/api/slots/[id]/route');

      const request = new NextRequest(
        `http://localhost:3000/api/slots/${TEST_SLOT_ID}?permanent=true`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.permanent).toBe(true);
      expect(deletedBookingSlotIds).toContain(TEST_SLOT_ID);
      expect(deletedSlotIds).toContain(TEST_SLOT_ID);
    });

    it('does not send cancellation emails on permanent delete', async () => {
      const { sendEmail } = await import('@/lib/google');
      mockBookings = [
        { id: 'b1', email: 'a@test.com', first_name: 'A', last_name: 'B', cancelled_at: null },
      ];

      const { DELETE } = await import('@/app/api/slots/[id]/route');

      const request = new NextRequest(
        `http://localhost:3000/api/slots/${TEST_SLOT_ID}?permanent=true`,
        { method: 'DELETE' }
      );

      await DELETE(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('works on slots with no bookings', async () => {
      mockBookings = [];

      const { DELETE } = await import('@/app/api/slots/[id]/route');

      const request = new NextRequest(
        `http://localhost:3000/api/slots/${TEST_SLOT_ID}?permanent=true`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.permanent).toBe(true);
    });
  });

  describe('Soft cancel (default)', () => {
    it('soft-cancels a slot without permanent flag', async () => {
      const { DELETE } = await import('@/app/api/slots/[id]/route');

      const request = new NextRequest(
        `http://localhost:3000/api/slots/${TEST_SLOT_ID}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.permanent).toBeUndefined();
      expect(updatedSlots.some(s => s.is_cancelled === true)).toBe(true);
      expect(deletedSlotIds).toHaveLength(0);
    });

    it('sends cancellation emails to active bookings on soft cancel', async () => {
      const { sendEmail } = await import('@/lib/google');
      mockBookings = [
        { id: 'b1', email: 'a@test.com', first_name: 'A', last_name: 'B', cancelled_at: null },
      ];

      const { DELETE } = await import('@/app/api/slots/[id]/route');

      const request = new NextRequest(
        `http://localhost:3000/api/slots/${TEST_SLOT_ID}`,
        { method: 'DELETE' }
      );

      await DELETE(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });

      expect(sendEmail).toHaveBeenCalled();
    });
  });

  describe('Auth and access control', () => {
    it('returns 401 when not authenticated', async () => {
      const { getSession } = await import('@/lib/auth');
      vi.mocked(getSession).mockResolvedValueOnce(null);

      const { DELETE } = await import('@/app/api/slots/[id]/route');

      const request = new NextRequest(
        `http://localhost:3000/api/slots/${TEST_SLOT_ID}?permanent=true`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });
      expect(response.status).toBe(401);
    });

    it('returns 404 when slot not found', async () => {
      mockSlot = null;

      const { DELETE } = await import('@/app/api/slots/[id]/route');

      const request = new NextRequest(
        `http://localhost:3000/api/slots/nonexistent?permanent=true`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      expect(response.status).toBe(404);
    });

    it('returns 404 when user does not host the event', async () => {
      mockEvent = { ...mockEvent!, host_email: 'other@test.com' };

      const { DELETE } = await import('@/app/api/slots/[id]/route');

      const request = new NextRequest(
        `http://localhost:3000/api/slots/${TEST_SLOT_ID}?permanent=true`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, { params: Promise.resolve({ id: TEST_SLOT_ID }) });
      expect(response.status).toBe(404);
    });
  });
});
