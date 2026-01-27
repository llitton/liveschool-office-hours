import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Slack Integration Tests
 *
 * Tests Slack configuration, message formatting, and notification functions.
 * Supabase and fetch are mocked.
 */

// ============================================
// MOCK SETUP
// ============================================

let mockSlackConfig: Record<string, unknown> | null = null;
const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'oh_slack_config') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(async () => ({
                data: mockSlackConfig,
                error: mockSlackConfig ? null : { code: 'PGRST116' },
              })),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
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
// TESTS
// ============================================

describe('Slack Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSlackConfig = null;
    mockFetch.mockReset();
  });

  describe('getSlackConfig', () => {
    it('returns null when no config exists', async () => {
      mockSlackConfig = null;
      vi.resetModules();
      const { getSlackConfig } = await import('@/lib/slack');

      const config = await getSlackConfig();
      expect(config).toBe(null);
    });

    it('returns config when it exists', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        default_channel: '#general',
        notify_on_booking: true,
        daily_digest: true,
        post_session_summary: true,
        is_active: true,
      };
      vi.resetModules();
      const { getSlackConfig } = await import('@/lib/slack');

      const config = await getSlackConfig();
      expect(config).toEqual(mockSlackConfig);
    });
  });

  describe('saveSlackConfig', () => {
    it('saves new config to database', async () => {
      vi.resetModules();
      const { saveSlackConfig } = await import('@/lib/slack');

      const result = await saveSlackConfig({
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        default_channel: '#notifications',
        notify_on_booking: true,
      });

      expect(result).toBe(true);
    });

    it('uses defaults for optional fields', async () => {
      vi.resetModules();
      const { saveSlackConfig } = await import('@/lib/slack');

      const result = await saveSlackConfig({
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
      });

      expect(result).toBe(true);
    });
  });

  describe('sendSlackMessage', () => {
    it('returns false when no config exists', async () => {
      mockSlackConfig = null;
      vi.resetModules();
      const { sendSlackMessage } = await import('@/lib/slack');

      const result = await sendSlackMessage({
        text: 'Test message',
      });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends message to webhook when config exists', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendSlackMessage } = await import('@/lib/slack');

      const result = await sendSlackMessage({
        text: 'Test message',
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/T00/B00/XXX',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('returns false when webhook fails', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      vi.resetModules();
      const { sendSlackMessage } = await import('@/lib/slack');

      const result = await sendSlackMessage({
        text: 'Test message',
      });

      expect(result).toBe(false);
    });

    it('handles fetch errors gracefully', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        is_active: true,
      };
      mockFetch.mockRejectedValue(new Error('Network error'));
      vi.resetModules();
      const { sendSlackMessage } = await import('@/lib/slack');

      const result = await sendSlackMessage({
        text: 'Test message',
      });

      expect(result).toBe(false);
    });

    it('sends message with blocks', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendSlackMessage } = await import('@/lib/slack');

      await sendSlackMessage({
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'Test Header',
            },
          },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('blocks'),
        })
      );
    });
  });

  describe('notifyNewBooking', () => {
    const mockBooking = {
      id: 'booking-123',
      attendee_name: 'John Doe',
      attendee_email: 'john@example.com',
      question_responses: {
        'q1': 'Question about office hours',
      },
    };

    const mockEvent = {
      name: 'Office Hours',
      slug: 'office-hours',
      custom_questions: [
        { id: 'q1', question: 'What topics would you like to discuss?' },
      ],
      timezone: 'America/Chicago',
    };

    const mockSlot = {
      start_time: '2024-01-15T14:00:00Z',
      end_time: '2024-01-15T14:30:00Z',
    };

    it('returns false when notify_on_booking is disabled', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        notify_on_booking: false,
        is_active: true,
      };
      vi.resetModules();
      const { notifyNewBooking } = await import('@/lib/slack');

      const result = await notifyNewBooking(mockBooking, mockEvent, mockSlot);

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends notification when enabled', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        notify_on_booking: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { notifyNewBooking } = await import('@/lib/slack');

      const result = await notifyNewBooking(mockBooking, mockEvent, mockSlot);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('includes booking details in message', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        notify_on_booking: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { notifyNewBooking } = await import('@/lib/slack');

      await notifyNewBooking(mockBooking, mockEvent, mockSlot);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      // Should include booking info in blocks
      expect(JSON.stringify(body.blocks)).toContain('John Doe');
      expect(JSON.stringify(body.blocks)).toContain('Office Hours');
    });

    it('includes question responses when provided', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        notify_on_booking: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { notifyNewBooking } = await import('@/lib/slack');

      await notifyNewBooking(mockBooking, mockEvent, mockSlot);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      // Should include the response text
      expect(JSON.stringify(body.blocks)).toContain('Question about office hours');
      // Should include the question label
      expect(JSON.stringify(body.blocks)).toContain('What topics would you like to discuss?');
    });

    it('does not include Google Meet link (host gets it via calendar)', async () => {
      // Google Meet links are intentionally omitted from Slack notifications
      // because the host already receives them in the calendar invitation
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        notify_on_booking: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { notifyNewBooking } = await import('@/lib/slack');

      const slotWithMeetLink = {
        ...mockSlot,
        google_meet_link: 'https://meet.google.com/abc-defg-hij',
      };

      await notifyNewBooking(mockBooking, mockEvent, slotWithMeetLink);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      // Meet link should NOT be in the blocks (intentionally omitted)
      expect(JSON.stringify(body.blocks)).not.toContain('meet.google.com');
    });
  });

  describe('sendDailyDigest', () => {
    it('returns false when daily_digest is disabled', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        daily_digest: false,
        is_active: true,
      };
      vi.resetModules();
      const { sendDailyDigest } = await import('@/lib/slack');

      const result = await sendDailyDigest([]);

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends "no sessions" message when list is empty', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        daily_digest: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendDailyDigest } = await import('@/lib/slack');

      await sendDailyDigest([]);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.text).toContain('No sessions');
    });

    it('sends session list when sessions exist', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        daily_digest: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendDailyDigest } = await import('@/lib/slack');

      const sessions = [
        {
          eventName: 'Office Hours',
          startTime: '2024-01-15T14:00:00Z',
          bookingCount: 3,
          googleMeetLink: 'https://meet.google.com/abc',
        },
        {
          eventName: 'Demo Call',
          startTime: '2024-01-15T15:00:00Z',
          bookingCount: 1,
        },
      ];

      await sendDailyDigest(sessions);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(JSON.stringify(body.blocks)).toContain('Office Hours');
      expect(JSON.stringify(body.blocks)).toContain('Demo Call');
      expect(JSON.stringify(body.blocks)).toContain('2 session');
    });

    it('pluralizes attendee count correctly', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        daily_digest: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendDailyDigest } = await import('@/lib/slack');

      const sessions = [
        {
          eventName: 'Single Attendee',
          startTime: '2024-01-15T14:00:00Z',
          bookingCount: 1,
        },
        {
          eventName: 'Multiple Attendees',
          startTime: '2024-01-15T15:00:00Z',
          bookingCount: 5,
        },
      ];

      await sendDailyDigest(sessions);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const blocksStr = JSON.stringify(body.blocks);

      expect(blocksStr).toContain('1 attendee)');
      expect(blocksStr).toContain('5 attendees)');
    });
  });

  describe('sendSessionSummary', () => {
    it('returns false when post_session_summary is disabled', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        post_session_summary: false,
        is_active: true,
      };
      vi.resetModules();
      const { sendSessionSummary } = await import('@/lib/slack');

      const result = await sendSessionSummary({
        eventName: 'Office Hours',
        startTime: '2024-01-15T14:00:00Z',
        attendedCount: 3,
        noShowCount: 1,
        topics: [],
      });

      expect(result).toBe(false);
    });

    it('sends summary when enabled', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        post_session_summary: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendSessionSummary } = await import('@/lib/slack');

      const result = await sendSessionSummary({
        eventName: 'Office Hours',
        startTime: '2024-01-15T14:00:00Z',
        attendedCount: 3,
        noShowCount: 1,
        topics: ['Question 1', 'Question 2'],
      });

      expect(result).toBe(true);
    });

    it('includes attendance stats in message', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        post_session_summary: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendSessionSummary } = await import('@/lib/slack');

      await sendSessionSummary({
        eventName: 'Office Hours',
        startTime: '2024-01-15T14:00:00Z',
        attendedCount: 3,
        noShowCount: 1,
        topics: [],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const blocksStr = JSON.stringify(body.blocks);

      expect(blocksStr).toContain('3 attended');
      expect(blocksStr).toContain('1 no-show');
    });

    it('includes topics when provided', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        post_session_summary: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendSessionSummary } = await import('@/lib/slack');

      await sendSessionSummary({
        eventName: 'Office Hours',
        startTime: '2024-01-15T14:00:00Z',
        attendedCount: 3,
        noShowCount: 0,
        topics: ['React hooks', 'State management'],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const blocksStr = JSON.stringify(body.blocks);

      expect(blocksStr).toContain('React hooks');
      expect(blocksStr).toContain('State management');
    });
  });

  describe('testSlackWebhook', () => {
    it('returns true when webhook is valid', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { testSlackWebhook } = await import('@/lib/slack');

      const result = await testSlackWebhook(
        'https://hooks.slack.com/services/T00/B00/XXX'
      );

      expect(result).toBe(true);
    });

    it('returns false when webhook fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      vi.resetModules();
      const { testSlackWebhook } = await import('@/lib/slack');

      const result = await testSlackWebhook(
        'https://hooks.slack.com/services/INVALID'
      );

      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      vi.resetModules();
      const { testSlackWebhook } = await import('@/lib/slack');

      const result = await testSlackWebhook(
        'https://hooks.slack.com/services/T00/B00/XXX'
      );

      expect(result).toBe(false);
    });

    it('sends test message to webhook', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { testSlackWebhook } = await import('@/lib/slack');

      await testSlackWebhook('https://hooks.slack.com/services/T00/B00/XXX');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/T00/B00/XXX',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test message'),
        })
      );
    });
  });

  describe('sendDetailedSessionSummary', () => {
    it('returns false when post_session_summary is disabled', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        post_session_summary: false,
        is_active: true,
      };
      vi.resetModules();
      const { sendDetailedSessionSummary } = await import('@/lib/slack');

      const result = await sendDetailedSessionSummary({
        eventName: 'Office Hours',
        startTime: '2024-01-15T14:00:00Z',
        attendees: [
          { name: 'John Doe', email: 'john@example.com', attended: true, noShow: false },
        ],
      });

      expect(result).toBe(false);
    });

    it('sends detailed summary when enabled', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        post_session_summary: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendDetailedSessionSummary } = await import('@/lib/slack');

      const result = await sendDetailedSessionSummary({
        eventName: 'Office Hours',
        startTime: '2024-01-15T14:00:00Z',
        attendees: [
          { name: 'John Doe', email: 'john@example.com', attended: true, noShow: false },
          { name: 'Jane Smith', email: 'jane@example.com', attended: false, noShow: true },
        ],
      });

      expect(result).toBe(true);
    });

    it('includes attendee details in message', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        post_session_summary: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendDetailedSessionSummary } = await import('@/lib/slack');

      await sendDetailedSessionSummary({
        eventName: 'Office Hours',
        startTime: '2024-01-15T14:00:00Z',
        attendees: [
          { name: 'John Doe', email: 'john@example.com', attended: true, noShow: false },
          { name: 'Jane Smith', email: 'jane@example.com', attended: false, noShow: true },
        ],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const blocksStr = JSON.stringify(body.blocks);

      expect(blocksStr).toContain('John Doe');
      expect(blocksStr).toContain('Jane Smith');
      expect(blocksStr).toContain('john@example.com');
      expect(blocksStr).toContain('attended');
      expect(blocksStr).toContain('no-show');
    });

    it('includes question responses when provided', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        post_session_summary: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendDetailedSessionSummary } = await import('@/lib/slack');

      await sendDetailedSessionSummary({
        eventName: 'Office Hours',
        startTime: '2024-01-15T14:00:00Z',
        attendees: [
          {
            name: 'John Doe',
            email: 'john@example.com',
            attended: true,
            noShow: false,
            questionResponses: { q1: 'How do I use rewards?' },
          },
        ],
        customQuestions: [{ id: 'q1', question: 'What topics do you want to discuss?' }],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const blocksStr = JSON.stringify(body.blocks);

      expect(blocksStr).toContain('What topics do you want to discuss?');
      expect(blocksStr).toContain('How do I use rewards?');
    });

    it('includes recording link when provided', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        post_session_summary: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendDetailedSessionSummary } = await import('@/lib/slack');

      await sendDetailedSessionSummary({
        eventName: 'Office Hours',
        startTime: '2024-01-15T14:00:00Z',
        attendees: [
          { name: 'John Doe', email: 'john@example.com', attended: true, noShow: false },
        ],
        recordingLink: 'https://fireflies.ai/recording/abc123',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const blocksStr = JSON.stringify(body.blocks);

      expect(blocksStr).toContain('fireflies.ai');
      expect(blocksStr).toContain('Recording');
    });

    it('includes deck link when provided', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        post_session_summary: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendDetailedSessionSummary } = await import('@/lib/slack');

      await sendDetailedSessionSummary({
        eventName: 'Office Hours',
        startTime: '2024-01-15T14:00:00Z',
        attendees: [
          { name: 'John Doe', email: 'john@example.com', attended: true, noShow: false },
        ],
        deckLink: 'https://docs.google.com/presentation/d/abc123',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const blocksStr = JSON.stringify(body.blocks);

      expect(blocksStr).toContain('docs.google.com');
      expect(blocksStr).toContain('Deck');
    });

    it('includes shared links when provided', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        post_session_summary: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendDetailedSessionSummary } = await import('@/lib/slack');

      await sendDetailedSessionSummary({
        eventName: 'Office Hours',
        startTime: '2024-01-15T14:00:00Z',
        attendees: [
          { name: 'John Doe', email: 'john@example.com', attended: true, noShow: false },
        ],
        sharedLinks: [
          { title: 'Help Article', url: 'https://help.liveschool.com/rewards' },
          { title: 'Training Video', url: 'https://youtube.com/watch?v=abc123' },
        ],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const blocksStr = JSON.stringify(body.blocks);

      expect(blocksStr).toContain('Help Article');
      expect(blocksStr).toContain('help.liveschool.com');
      expect(blocksStr).toContain('Training Video');
      expect(blocksStr).toContain('youtube.com');
    });

    it('includes all resources together in resources section', async () => {
      mockSlackConfig = {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
        post_session_summary: true,
        is_active: true,
      };
      mockFetch.mockResolvedValue({ ok: true });
      vi.resetModules();
      const { sendDetailedSessionSummary } = await import('@/lib/slack');

      await sendDetailedSessionSummary({
        eventName: 'Office Hours',
        startTime: '2024-01-15T14:00:00Z',
        attendees: [
          { name: 'John Doe', email: 'john@example.com', attended: true, noShow: false },
        ],
        recordingLink: 'https://fireflies.ai/recording/abc123',
        deckLink: 'https://docs.google.com/presentation/d/xyz',
        sharedLinks: [
          { title: 'Resource Guide', url: 'https://example.com/guide' },
        ],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const blocksStr = JSON.stringify(body.blocks);

      // All resources should be in the message
      expect(blocksStr).toContain('Resources');
      expect(blocksStr).toContain('Recording');
      expect(blocksStr).toContain('Deck');
      expect(blocksStr).toContain('Resource Guide');
    });
  });
});
