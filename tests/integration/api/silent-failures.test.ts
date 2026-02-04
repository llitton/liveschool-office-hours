import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================
// TESTS FOR SILENT FAILURE FIXES (commit d1ba7bd)
//
// These tests verify that database errors which
// were previously swallowed silently now surface
// as thrown errors, logged messages, or error
// responses.
// ============================================

// ============================================
// MOCKS - Module-level state used by all tests
// ============================================

// Test mode controls which mock shape is returned
let testMode: 'availability' | 'check-slug' | 'post-session' = 'availability';

// State for availability sync tests (group 1)
let mockDeleteError: { message: string } | null = null;
let mockInsertError: { message: string } | null = null;

// State for slug suggestion tests (group 2)
let mockSlugQueryResults: Record<string, { data: unknown; error: unknown }> = {};

// State for post-session cron tests (group 3)
let mockSlotQueryError: { message: string } | null = null;

// Mock auth (used by check-slug and post-session)
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ email: 'admin@test.com' }),
}));

// Mock Google APIs (used by availability and post-session)
vi.mock('@/lib/google', () => ({
  getFreeBusy: vi.fn().mockResolvedValue([
    { start: '2026-02-03T10:00:00Z', end: '2026-02-03T11:00:00Z' },
  ]),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock email-html (used by post-session)
vi.mock('@/lib/email-html', () => ({
  generateFollowupEmailHtml: vi.fn().mockReturnValue('<html>followup</html>'),
  generateFeedbackEmailHtml: vi.fn().mockReturnValue('<html>feedback</html>'),
  generateRecordingEmailHtml: vi.fn().mockReturnValue('<html>recording</html>'),
}));

// Mock timezone (used by post-session)
vi.mock('@/lib/timezone', () => ({
  getTimezoneAbbr: vi.fn().mockReturnValue('CT'),
}));

// Mock logger (used by post-session)
vi.mock('@/lib/logger', () => ({
  cronLogger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Unified Supabase mock that dispatches based on testMode
vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: () => ({
    from: vi.fn((table: string) => {
      // ---- Availability sync mode ----
      if (testMode === 'availability') {
        if (table === 'oh_busy_blocks') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockImplementation(() =>
                      Promise.resolve({ error: mockDeleteError })
                    ),
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockImplementation(() =>
              Promise.resolve({ error: mockInsertError })
            ),
          };
        }
      }

      // ---- Check-slug mode ----
      if (testMode === 'check-slug') {
        if (table === 'oh_events') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_field: string, slug: string) => {
                return {
                  maybeSingle: vi.fn().mockImplementation(() => {
                    const result = mockSlugQueryResults[slug];
                    if (result) {
                      return Promise.resolve(result);
                    }
                    // Default: slug is available (no row found)
                    return Promise.resolve({ data: null, error: null });
                  }),
                };
              }),
            }),
          };
        }
      }

      // ---- Post-session cron mode ----
      if (testMode === 'post-session') {
        if (table === 'oh_slots') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  gt: vi.fn().mockImplementation(() =>
                    Promise.resolve({
                      data: mockSlotQueryError ? null : [],
                      error: mockSlotQueryError,
                    })
                  ),
                }),
              }),
              not: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockImplementation(() =>
                    Promise.resolve({
                      data: mockSlotQueryError ? null : [],
                      error: mockSlotQueryError,
                    })
                  ),
                }),
              }),
            }),
          };
        }
        // Default fallback for other tables in post-session mode
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }

      // Generic fallback
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    }),
  }),
}));

// ============================================
// 1. AVAILABILITY SYNC - BUSY BLOCK ERRORS
// ============================================

describe('syncGoogleCalendarBusy - error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testMode = 'availability';
    mockDeleteError = null;
    mockInsertError = null;
  });

  afterEach(() => {
    mockDeleteError = null;
    mockInsertError = null;
  });

  it('throws when delete operation returns an error', { timeout: 15000 }, async () => {
    mockDeleteError = { message: 'permission denied for table oh_busy_blocks' };

    const { syncGoogleCalendarBusy } = await import('@/lib/availability');

    await expect(
      syncGoogleCalendarBusy(
        'admin-123',
        'mock-access-token',
        'mock-refresh-token',
        new Date('2026-02-03'),
        new Date('2026-02-10')
      )
    ).rejects.toThrow('Failed to clear existing busy blocks');
  });

  it('throws when insert operation returns an error', async () => {
    mockDeleteError = null;
    mockInsertError = { message: 'violates foreign key constraint' };

    const { syncGoogleCalendarBusy } = await import('@/lib/availability');

    await expect(
      syncGoogleCalendarBusy(
        'admin-123',
        'mock-access-token',
        'mock-refresh-token',
        new Date('2026-02-03'),
        new Date('2026-02-10')
      )
    ).rejects.toThrow('Failed to insert busy blocks');
  });
});

// ============================================
// 2. SLUG SUGGESTIONS - QUERY ERROR HANDLING
// ============================================

describe('GET /api/events/check-slug - slug suggestion error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testMode = 'check-slug';
    mockSlugQueryResults = {};
  });

  afterEach(() => {
    mockSlugQueryResults = {};
  });

  it('returns empty suggestions when all suggestion queries fail with errors', async () => {
    // The main slug is taken
    mockSlugQueryResults['test-event'] = {
      data: { id: 'event-1', name: 'Test Event' },
      error: null,
    };

    // All suggestion queries return errors
    const queryError = { message: 'connection timeout' };
    mockSlugQueryResults['test-event-team'] = { data: null, error: queryError };
    mockSlugQueryResults['test-event-2'] = { data: null, error: queryError };
    mockSlugQueryResults['test-event-new'] = { data: null, error: queryError };
    mockSlugQueryResults['test-event-v2'] = { data: null, error: queryError };
    // Numbered suffixes
    for (let i = 3; i <= 10; i++) {
      mockSlugQueryResults[`test-event-${i}`] = { data: null, error: queryError };
    }

    const { GET } = await import('@/app/api/events/check-slug/route');

    const request = new NextRequest('http://localhost:3000/api/events/check-slug?slug=test-event');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.available).toBe(false);
    expect(data.existingEventName).toBe('Test Event');
    expect(data.suggestions).toEqual([]);
  });

  it('returns suggestions normally when queries succeed and find available slugs', async () => {
    // The main slug is taken
    mockSlugQueryResults['test-event'] = {
      data: { id: 'event-1', name: 'Test Event' },
      error: null,
    };

    // Suggestion queries succeed - default result is { data: null, error: null }
    // which means the slug is available

    const { GET } = await import('@/app/api/events/check-slug/route');

    const request = new NextRequest('http://localhost:3000/api/events/check-slug?slug=test-event');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.available).toBe(false);
    expect(data.existingEventName).toBe('Test Event');
    expect(data.suggestions.length).toBeGreaterThan(0);
    expect(data.suggestions).toContain('test-event-team');
  });
});

// ============================================
// 3. POST-SESSION CRON - QUERY FAILURE LOGGING
// ============================================

describe('GET /api/cron/post-session - query failure handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testMode = 'post-session';
    mockSlotQueryError = null;
  });

  afterEach(() => {
    mockSlotQueryError = null;
  });

  it('includes error messages in response when all slot queries fail', async () => {
    mockSlotQueryError = { message: 'Query failed' };

    const { GET } = await import('@/app/api/cron/post-session/route');

    const response = await GET();
    const data = await response.json();

    // The response should contain error messages from the failed queries
    expect(data.errors).toBeDefined();
    expect(data.errors.length).toBeGreaterThanOrEqual(4);
    expect(data.errors.some((e: string) => e.includes('Followup slots query failed'))).toBe(true);
    expect(data.errors.some((e: string) => e.includes('No-show slots query failed'))).toBe(true);
    expect(data.errors.some((e: string) => e.includes('Feedback slots query failed'))).toBe(true);
    expect(data.errors.some((e: string) => e.includes('Recording slots query failed'))).toBe(true);
  });

  it('returns success with no errors when queries succeed with no slots', async () => {
    mockSlotQueryError = null; // All queries return { data: [], error: null }

    const { GET } = await import('@/app/api/cron/post-session/route');

    const response = await GET();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.followupSent).toBe(0);
    expect(data.noShowSent).toBe(0);
    expect(data.feedbackSent).toBe(0);
    expect(data.recordingsSent).toBe(0);
    expect(data.errors).toBeUndefined();
  });
});
