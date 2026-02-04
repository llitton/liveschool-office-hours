import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail } from '@/lib/google';
import { generateFollowupEmailHtml, generateFeedbackEmailHtml, generateRecordingEmailHtml } from '@/lib/email-html';

/**
 * Post-Session Cron Job Tests
 *
 * Tests the hourly cron that sends follow-up emails, no-show re-engagement emails,
 * feedback requests, and recording notifications after sessions end.
 */

// ============================================
// MOCK SETUP
// ============================================

vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://test.liveschoolhelp.com');

// Supabase mock data and tracking
let slotQueryResults: Record<string, unknown>[];
let noShowSlotQueryResults: Record<string, unknown>[];
let feedbackSlotQueryResults: Record<string, unknown>[];
let recordingSlotQueryResults: Record<string, unknown>[];
let adminQueryResults: Record<string, Record<string, unknown> | null>;
let notesQueryResults: Record<string, unknown>[];
let tasksQueryResults: Record<string, unknown>[];
let updateCalls: Array<{ table: string; data: Record<string, unknown>; id: string }>;
let slotQueryError: { message: string } | null;
let noShowSlotQueryError: { message: string } | null;
let feedbackSlotQueryError: { message: string } | null;
let recordingSlotQueryError: { message: string } | null;

// Tracks which query we are on for oh_slots .from() calls
let slotQueryCallIndex: number;

function createChainableQuery(finalData: unknown, finalError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is', 'not', 'order', 'limit'];

  methods.forEach((method) => {
    chain[method] = vi.fn().mockReturnValue(chain);
  });

  chain.single = vi.fn().mockResolvedValue({ data: finalData, error: finalError });
  chain.then = (resolve: (val: unknown) => void) => {
    const result = { data: finalData, error: finalError };
    resolve(result);
    return Promise.resolve(result);
  };

  return chain;
}

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: () => ({
    from: vi.fn((table: string) => {
      if (table === 'oh_slots') {
        const idx = slotQueryCallIndex++;
        // Queries are called in order: followup (0), no-show (1), feedback (2), recording (3)
        if (idx === 0) {
          return createChainableQuery(slotQueryResults, slotQueryError);
        } else if (idx === 1) {
          return createChainableQuery(noShowSlotQueryResults, noShowSlotQueryError);
        } else if (idx === 2) {
          return createChainableQuery(feedbackSlotQueryResults, feedbackSlotQueryError);
        } else {
          return createChainableQuery(recordingSlotQueryResults, recordingSlotQueryError);
        }
      }

      if (table === 'oh_admins') {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockImplementation((_field: string, value: string) => {
          const admin = adminQueryResults[value] ?? null;
          return {
            single: vi.fn().mockResolvedValue({ data: admin, error: admin ? null : { message: 'Not found' } }),
          };
        });
        return chain;
      }

      if (table === 'oh_attendee_notes') {
        return createChainableQuery(notesQueryResults);
      }

      if (table === 'oh_quick_tasks') {
        return createChainableQuery(tasksQueryResults);
      }

      if (table === 'oh_bookings') {
        return {
          update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
            const updateChain: Record<string, unknown> = {};
            updateChain.eq = vi.fn().mockImplementation((_field: string, id: string) => {
              updateCalls.push({ table: 'oh_bookings', data, id });
              return Promise.resolve({ error: null });
            });
            return updateChain;
          }),
        };
      }

      return createChainableQuery(null);
    }),
  }),
}));

vi.mock('@/lib/google', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/email-html', () => ({
  generateFollowupEmailHtml: vi.fn().mockReturnValue('<html>followup</html>'),
  generateFeedbackEmailHtml: vi.fn().mockReturnValue('<html>feedback</html>'),
  generateRecordingEmailHtml: vi.fn().mockReturnValue('<html>recording</html>'),
}));

vi.mock('@/lib/timezone', () => ({
  getTimezoneAbbr: vi.fn().mockReturnValue('CT'),
}));

vi.mock('@/lib/logger', () => ({
  cronLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Cast imported mocks
const mockSendEmail = vi.mocked(sendEmail);
const mockGenerateFollowupEmailHtml = vi.mocked(generateFollowupEmailHtml);
const mockGenerateFeedbackEmailHtml = vi.mocked(generateFeedbackEmailHtml);
const mockGenerateRecordingEmailHtml = vi.mocked(generateRecordingEmailHtml);

// ============================================
// HELPERS
// ============================================

const now = new Date();

function hoursAgo(hours: number): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    name: 'Office Hours',
    slug: 'office-hours',
    host_name: 'Laura',
    host_email: 'host@test.com',
    timezone: 'America/Chicago',
    automated_emails_enabled: true,
    no_show_emails_enabled: true,
    no_show_email_delay_hours: 2,
    no_show_subject: null,
    no_show_body: null,
    ...overrides,
  };
}

function makeSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'slot-1',
    event_id: 'event-1',
    start_time: hoursAgo(3),
    end_time: hoursAgo(2.5),
    is_cancelled: false,
    recording_link: null,
    deck_link: null,
    shared_links: null,
    skip_automated_emails: false,
    ...overrides,
  };
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    slot_id: 'slot-1',
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    attended_at: new Date().toISOString(),
    no_show_at: null,
    cancelled_at: null,
    followup_sent_at: null,
    no_show_email_sent_at: null,
    feedback_sent_at: null,
    recording_sent_at: null,
    manage_token: 'token-abc',
    ...overrides,
  };
}

function makeAdmin(overrides: Record<string, unknown> = {}) {
  return {
    id: 'admin-1',
    email: 'host@test.com',
    name: 'Test Host',
    google_access_token: 'access-token-123',
    google_refresh_token: 'refresh-token-123',
    ...overrides,
  };
}

// Import the handler (uses mocked modules)
import { GET } from '@/app/api/cron/post-session/route';

// ============================================
// TESTS
// ============================================

describe('POST /api/cron/post-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset query tracking
    slotQueryCallIndex = 0;
    updateCalls = [];

    // Default: no slots for any section
    slotQueryResults = [];
    noShowSlotQueryResults = [];
    feedbackSlotQueryResults = [];
    recordingSlotQueryResults = [];
    slotQueryError = null;
    noShowSlotQueryError = null;
    feedbackSlotQueryError = null;
    recordingSlotQueryError = null;

    // Default admin with tokens
    adminQueryResults = {
      'host@test.com': makeAdmin(),
    };

    // Default: no notes or tasks
    notesQueryResults = [];
    tasksQueryResults = [];
  });

  // Helper to call the GET handler
  async function callCron(headers?: Record<string, string>) {
    if (headers) {
      const request = new Request('http://localhost/api/cron/post-session', {
        headers,
      });
      return GET(request);
    }

    return GET();
  }

  // ------------------------------------------
  // Auth
  // ------------------------------------------
  describe('Authentication', () => {
    it('returns 401 when CRON_SECRET is set and auth header does not match', async () => {
      vi.stubEnv('CRON_SECRET', 'my-secret');

      const response = await callCron({ authorization: 'Bearer wrong-secret' });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');

      vi.unstubAllEnvs();
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://test.liveschoolhelp.com');
    });

    it('allows request when CRON_SECRET is not set', async () => {
      delete process.env.CRON_SECRET;

      const response = await callCron();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveProperty('followupSent');
    });
  });

  // ------------------------------------------
  // Follow-up emails
  // ------------------------------------------
  describe('Follow-up emails', () => {
    it('sends follow-up email to attended bookings in the 2-3 hour window', async () => {
      const event = makeEvent();
      const booking = makeBooking({ attended_at: now.toISOString() });
      const slot = makeSlot({
        event,
        bookings: [booking],
      });

      slotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.followupSent).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        'access-token-123',
        'refresh-token-123',
        expect.objectContaining({
          to: 'jane@example.com',
          subject: 'Thanks for joining Office Hours!',
          from: 'host@test.com',
        })
      );
      expect(mockGenerateFollowupEmailHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientFirstName: 'Jane',
          isNoShow: false,
        })
      );
      // Should update followup_sent_at
      expect(updateCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table: 'oh_bookings',
            data: expect.objectContaining({ followup_sent_at: expect.any(String) }),
            id: 'booking-1',
          }),
        ])
      );
    });

    it('skips follow-up when followup_sent_at is already set', async () => {
      const event = makeEvent();
      const booking = makeBooking({
        attended_at: now.toISOString(),
        followup_sent_at: now.toISOString(),
      });
      const slot = makeSlot({ event, bookings: [booking] });

      slotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.followupSent).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('skips follow-up for cancelled bookings', async () => {
      const event = makeEvent();
      const booking = makeBooking({
        attended_at: now.toISOString(),
        cancelled_at: now.toISOString(),
      });
      const slot = makeSlot({ event, bookings: [booking] });

      slotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.followupSent).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('skips follow-up for bookings not marked as attended', async () => {
      const event = makeEvent();
      const booking = makeBooking({ attended_at: null });
      const slot = makeSlot({ event, bookings: [booking] });

      slotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.followupSent).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('skips follow-up when automated_emails_enabled is false on event', async () => {
      const event = makeEvent({ automated_emails_enabled: false });
      const booking = makeBooking({ attended_at: now.toISOString() });
      const slot = makeSlot({ event, bookings: [booking] });

      slotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.followupSent).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('skips follow-up when skip_automated_emails is true on slot', async () => {
      const event = makeEvent();
      const booking = makeBooking({ attended_at: now.toISOString() });
      const slot = makeSlot({
        event,
        bookings: [booking],
        skip_automated_emails: true,
      });

      slotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.followupSent).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('includes notes and tasks in follow-up custom message', async () => {
      const event = makeEvent();
      const booking = makeBooking({ attended_at: now.toISOString() });
      const slot = makeSlot({ event, bookings: [booking] });

      slotQueryResults = [slot];
      notesQueryResults = [{ note: 'Great session!' }];
      tasksQueryResults = [{ title: 'Send deck', completed_at: null }];

      const response = await callCron();
      const body = await response.json();

      expect(body.followupSent).toBe(1);
      expect(mockGenerateFollowupEmailHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          customMessage: expect.stringContaining('Session notes:'),
        })
      );
      expect(mockGenerateFollowupEmailHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          customMessage: expect.stringContaining('Follow-up items:'),
        })
      );
    });
  });

  // ------------------------------------------
  // No-show emails
  // ------------------------------------------
  describe('No-show emails', () => {
    it('sends no-show email after delay window elapses', async () => {
      const event = makeEvent({ no_show_email_delay_hours: 2 });
      const booking = makeBooking({
        id: 'noshow-booking-1',
        attended_at: null,
        no_show_at: hoursAgo(3),
        no_show_email_sent_at: null,
      });
      // Slot ended 3 hours ago, delay is 2 hours, so we're past the window
      const slot = makeSlot({
        id: 'noshow-slot-1',
        event,
        bookings: [booking],
        end_time: hoursAgo(3),
      });

      noShowSlotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.noShowSent).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        'access-token-123',
        'refresh-token-123',
        expect.objectContaining({
          to: 'jane@example.com',
        })
      );
      expect(mockGenerateFollowupEmailHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          isNoShow: true,
        })
      );
    });

    it('skips no-show email when no_show_emails_enabled is false', async () => {
      const event = makeEvent({ no_show_emails_enabled: false });
      const booking = makeBooking({
        attended_at: null,
        no_show_at: hoursAgo(3),
      });
      const slot = makeSlot({
        event,
        bookings: [booking],
        end_time: hoursAgo(3),
      });

      noShowSlotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.noShowSent).toBe(0);
    });

    it('skips no-show email when no_show_email_sent_at is already set', async () => {
      const event = makeEvent({ no_show_email_delay_hours: 2 });
      const booking = makeBooking({
        attended_at: null,
        no_show_at: hoursAgo(3),
        no_show_email_sent_at: hoursAgo(1),
      });
      const slot = makeSlot({
        event,
        bookings: [booking],
        end_time: hoursAgo(3),
      });

      noShowSlotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.noShowSent).toBe(0);
    });

    it('skips no-show email when automated_emails_enabled is false', async () => {
      const event = makeEvent({
        automated_emails_enabled: false,
        no_show_email_delay_hours: 2,
      });
      const booking = makeBooking({
        attended_at: null,
        no_show_at: hoursAgo(3),
      });
      const slot = makeSlot({
        event,
        bookings: [booking],
        end_time: hoursAgo(3),
      });

      noShowSlotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.noShowSent).toBe(0);
    });
  });

  // ------------------------------------------
  // Feedback requests
  // ------------------------------------------
  describe('Feedback requests', () => {
    it('sends feedback request to attended bookings', async () => {
      const event = makeEvent();
      const booking = makeBooking({
        id: 'feedback-booking-1',
        attended_at: now.toISOString(),
        feedback_sent_at: null,
        manage_token: 'feedback-token-123',
      });
      const slot = makeSlot({
        id: 'feedback-slot-1',
        event,
        bookings: [booking],
      });

      feedbackSlotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.feedbackSent).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        'access-token-123',
        'refresh-token-123',
        expect.objectContaining({
          to: 'jane@example.com',
          subject: 'How was Office Hours?',
        })
      );
      expect(mockGenerateFeedbackEmailHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientFirstName: 'Jane',
          feedbackUrl: 'https://test.liveschoolhelp.com/feedback/feedback-token-123',
        })
      );
    });

    it('skips feedback for no-show bookings', async () => {
      const event = makeEvent();
      const booking = makeBooking({
        attended_at: null,
        no_show_at: now.toISOString(),
        manage_token: 'token-abc',
      });
      const slot = makeSlot({ event, bookings: [booking] });

      feedbackSlotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.feedbackSent).toBe(0);
    });

    it('skips feedback when feedback_sent_at is already set', async () => {
      const event = makeEvent();
      const booking = makeBooking({
        attended_at: now.toISOString(),
        feedback_sent_at: now.toISOString(),
        manage_token: 'token-abc',
      });
      const slot = makeSlot({ event, bookings: [booking] });

      feedbackSlotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.feedbackSent).toBe(0);
    });

    it('sends feedback to unmarked bookings (neither attended nor no-show)', async () => {
      const event = makeEvent();
      const booking = makeBooking({
        attended_at: null,
        no_show_at: null,
        feedback_sent_at: null,
        manage_token: 'token-unmarked',
      });
      const slot = makeSlot({ event, bookings: [booking] });

      feedbackSlotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.feedbackSent).toBe(1);
    });
  });

  // ------------------------------------------
  // Recording emails
  // ------------------------------------------
  describe('Recording emails', () => {
    it('sends recording email when recording_link is set', async () => {
      const event = makeEvent();
      const booking = makeBooking({
        id: 'rec-booking-1',
        recording_sent_at: null,
      });
      const slot = makeSlot({
        id: 'rec-slot-1',
        event,
        bookings: [booking],
        recording_link: 'https://fireflies.ai/recording/123',
        deck_link: 'https://slides.com/deck',
      });

      recordingSlotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.recordingsSent).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        'access-token-123',
        'refresh-token-123',
        expect.objectContaining({
          to: 'jane@example.com',
          subject: 'Recording: Office Hours',
        })
      );
      expect(mockGenerateRecordingEmailHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          recordingLink: 'https://fireflies.ai/recording/123',
          deckLink: 'https://slides.com/deck',
          bookingPageUrl: 'https://test.liveschoolhelp.com/book/office-hours',
        })
      );
    });

    it('skips recording email when recording_sent_at is already set', async () => {
      const event = makeEvent();
      const booking = makeBooking({
        recording_sent_at: now.toISOString(),
      });
      const slot = makeSlot({
        event,
        bookings: [booking],
        recording_link: 'https://fireflies.ai/recording/123',
      });

      recordingSlotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.recordingsSent).toBe(0);
    });

    it('skips recording email when skip_automated_emails is true on slot', async () => {
      const event = makeEvent();
      const booking = makeBooking({ recording_sent_at: null });
      const slot = makeSlot({
        event,
        bookings: [booking],
        recording_link: 'https://fireflies.ai/recording/123',
        skip_automated_emails: true,
      });

      recordingSlotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(body.recordingsSent).toBe(0);
    });
  });

  // ------------------------------------------
  // Missing admin tokens
  // ------------------------------------------
  describe('Missing admin tokens', () => {
    it('skips sending when host has no Google tokens', async () => {
      adminQueryResults = {
        'host@test.com': makeAdmin({
          google_access_token: null,
          google_refresh_token: null,
        }),
      };

      const event = makeEvent();
      const booking = makeBooking({ attended_at: now.toISOString() });
      const slot = makeSlot({ event, bookings: [booking] });

      slotQueryResults = [slot];
      feedbackSlotQueryResults = [
        makeSlot({
          event,
          bookings: [makeBooking({ attended_at: now.toISOString(), manage_token: 'tk' })],
        }),
      ];
      recordingSlotQueryResults = [
        makeSlot({
          event,
          bookings: [makeBooking({ recording_sent_at: null })],
          recording_link: 'https://recording.com/abc',
        }),
      ];

      const response = await callCron();
      const body = await response.json();

      expect(body.followupSent).toBe(0);
      expect(body.feedbackSent).toBe(0);
      expect(body.recordingsSent).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Success response
  // ------------------------------------------
  describe('Success response', () => {
    it('returns success with all counts when no errors', async () => {
      const response = await callCron();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.followupSent).toBe(0);
      expect(body.noShowSent).toBe(0);
      expect(body.feedbackSent).toBe(0);
      expect(body.recordingsSent).toBe(0);
      expect(body.errors).toBeUndefined();
    });
  });

  // ------------------------------------------
  // Critical failure detection
  // ------------------------------------------
  describe('Critical failure detection', () => {
    it('returns 500 when more than 50% of send attempts fail', async () => {
      // Set up multiple bookings where sendEmail will fail
      mockSendEmail.mockRejectedValue(new Error('Gmail API error'));

      const event = makeEvent();
      const bookings = [
        makeBooking({ id: 'b1', email: 'a@test.com', attended_at: now.toISOString() }),
        makeBooking({ id: 'b2', email: 'b@test.com', attended_at: now.toISOString() }),
        makeBooking({ id: 'b3', email: 'c@test.com', attended_at: now.toISOString() }),
      ];
      const slot = makeSlot({ event, bookings });

      slotQueryResults = [slot];

      const response = await callCron();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.message).toContain('Critical');
      expect(body.errors.length).toBe(3);
    });
  });
});
