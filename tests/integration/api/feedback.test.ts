import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================
// MOCKS
// ============================================

let mockSession: { email: string } | null = null;
let mockSlots: Record<string, unknown>[] = [];
let mockBookings: Record<string, unknown>[] = [];

// Mock auth module
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
}));

// Create mock Supabase client factory
function createMockSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'oh_slots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockSlots[0] || null,
                error: mockSlots[0] ? null : { message: 'Not found' },
              }),
            }),
          }),
        };
      }

      if (table === 'oh_bookings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: mockBookings,
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
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: () => mockSupabase,
}));

// ============================================
// TEST HELPERS
// ============================================

function createMockSlot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'slot-123',
    start_time: '2026-01-27T15:00:00.000Z',
    end_time: '2026-01-27T15:30:00.000Z',
    event: {
      id: 'event-123',
      name: 'Office Hours',
    },
    ...overrides,
  };
}

function createMockBooking(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'booking-123',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    feedback_rating: 5,
    feedback_comment: 'Great session!',
    feedback_topic_suggestion: 'More about reports',
    feedback_submitted_at: '2026-01-27T16:00:00.000Z',
    ...overrides,
  };
}

function createFeedbackRequest(slotId: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/admin/sessions/${slotId}/feedback`,
    {
      method: 'GET',
    }
  );
}

// ============================================
// TESTS
// ============================================

describe('Session Feedback API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { email: 'admin@test.com' };
    mockSlots = [createMockSlot()];
    mockBookings = [];
    mockSupabase = createMockSupabaseClient();
  });

  afterEach(() => {
    mockSession = null;
    mockSlots = [];
    mockBookings = [];
  });

  describe('GET /api/admin/sessions/[id]/feedback', () => {
    it('returns 401 Unauthorized when no session exists', async () => {
      mockSession = null;

      const { GET } = await import(
        '@/app/api/admin/sessions/[id]/feedback/route'
      );

      const request = createFeedbackRequest('slot-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'slot-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 404 when slot is not found', async () => {
      mockSlots = []; // No slots
      mockSupabase = createMockSupabaseClient();

      const { GET } = await import(
        '@/app/api/admin/sessions/[id]/feedback/route'
      );

      const request = createFeedbackRequest('non-existent-slot');
      const response = await GET(request, { params: Promise.resolve({ id: 'non-existent-slot' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Session not found');
    });

    it('returns empty feedback array when no bookings have feedback', async () => {
      mockBookings = []; // No bookings with feedback

      const { GET } = await import(
        '@/app/api/admin/sessions/[id]/feedback/route'
      );

      const request = createFeedbackRequest('slot-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'slot-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.feedback).toEqual([]);
      expect(data.averageRating).toBeNull();
      expect(data.session.event_name).toBe('Office Hours');
    });

    it('returns feedback with correctly constructed attendee name from first_name and last_name', async () => {
      mockBookings = [
        createMockBooking({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          feedback_rating: 4,
          feedback_comment: 'Very helpful',
        }),
      ];

      const { GET } = await import(
        '@/app/api/admin/sessions/[id]/feedback/route'
      );

      const request = createFeedbackRequest('slot-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'slot-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.feedback).toHaveLength(1);
      expect(data.feedback[0].attendee_name).toBe('Jane Smith');
      expect(data.feedback[0].attendee_email).toBe('jane@example.com');
      expect(data.feedback[0].rating).toBe(4);
      expect(data.feedback[0].comment).toBe('Very helpful');
    });

    it('handles names with extra whitespace correctly', async () => {
      mockBookings = [
        createMockBooking({
          first_name: 'John',
          last_name: '', // Empty last name
          email: 'john@example.com',
          feedback_rating: 5,
        }),
      ];

      const { GET } = await import(
        '@/app/api/admin/sessions/[id]/feedback/route'
      );

      const request = createFeedbackRequest('slot-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'slot-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should trim the trailing space when last name is empty
      expect(data.feedback[0].attendee_name).toBe('John');
    });

    it('calculates average rating correctly for multiple feedback entries', async () => {
      mockBookings = [
        createMockBooking({ feedback_rating: 5 }),
        createMockBooking({ id: 'booking-456', feedback_rating: 4 }),
        createMockBooking({ id: 'booking-789', feedback_rating: 3 }),
      ];

      const { GET } = await import(
        '@/app/api/admin/sessions/[id]/feedback/route'
      );

      const request = createFeedbackRequest('slot-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'slot-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.feedback).toHaveLength(3);
      expect(data.averageRating).toBe(4); // (5 + 4 + 3) / 3 = 4
    });

    it('includes topic suggestions in the response', async () => {
      mockBookings = [
        createMockBooking({
          feedback_topic_suggestion: 'Would love to learn about dashboards',
        }),
      ];

      const { GET } = await import(
        '@/app/api/admin/sessions/[id]/feedback/route'
      );

      const request = createFeedbackRequest('slot-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'slot-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.feedback[0].topic_suggestion).toBe(
        'Would love to learn about dashboards'
      );
    });

    it('returns session metadata with the feedback', async () => {
      mockSlots = [
        createMockSlot({
          start_time: '2026-01-27T15:00:00.000Z',
          end_time: '2026-01-27T15:30:00.000Z',
          event: { id: 'event-123', name: 'LiveSchool Office Hours' },
        }),
      ];

      const { GET } = await import(
        '@/app/api/admin/sessions/[id]/feedback/route'
      );

      const request = createFeedbackRequest('slot-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'slot-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.id).toBe('slot-123');
      expect(data.session.start_time).toBe('2026-01-27T15:00:00.000Z');
      expect(data.session.end_time).toBe('2026-01-27T15:30:00.000Z');
      expect(data.session.event_name).toBe('LiveSchool Office Hours');
    });
  });
});
