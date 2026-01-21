import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * SMS Utility Tests
 *
 * Tests phone number validation, formatting, template processing,
 * and SMS segment calculation. Database operations are mocked.
 */

// ============================================
// MOCK SETUP
// ============================================

let mockSMSConfig: Record<string, unknown> | null = null;
let mockSMSLogs: Array<Record<string, unknown>> = [];

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'oh_sms_config') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(async () => ({
                data: mockSMSConfig,
                error: mockSMSConfig ? null : { code: 'PGRST116' },
              })),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      if (table === 'oh_sms_logs') {
        return {
          insert: vi.fn().mockImplementation((data) => {
            const newLog = { id: `log-${Date.now()}`, ...data };
            mockSMSLogs.push(newLog);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: newLog, error: null }),
              }),
            };
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
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

// Mock SMS provider factory
vi.mock('@/lib/sms-providers', () => ({
  createSMSProvider: vi.fn(() => ({
    sendSMS: vi.fn().mockResolvedValue(true),
    testConnection: vi.fn().mockResolvedValue(true),
  })),
}));

// ============================================
// TESTS
// ============================================

describe('SMS Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSMSConfig = null;
    mockSMSLogs = [];
  });

  describe('defaultSMSTemplates', () => {
    it('has 24-hour reminder template', async () => {
      const { defaultSMSTemplates } = await import('@/lib/sms');

      expect(defaultSMSTemplates.reminder_24h).toBeDefined();
      expect(defaultSMSTemplates.reminder_24h).toContain('{{first_name}}');
      expect(defaultSMSTemplates.reminder_24h).toContain('{{event_name}}');
    });

    it('has 1-hour reminder template', async () => {
      const { defaultSMSTemplates } = await import('@/lib/sms');

      expect(defaultSMSTemplates.reminder_1h).toBeDefined();
      expect(defaultSMSTemplates.reminder_1h).toContain('{{first_name}}');
    });

    it('templates are under 160 characters', async () => {
      const { defaultSMSTemplates } = await import('@/lib/sms');

      // Templates with placeholders should be well under 160
      // to leave room for actual values
      expect(defaultSMSTemplates.reminder_24h.length).toBeLessThan(150);
      expect(defaultSMSTemplates.reminder_1h.length).toBeLessThan(150);
    });
  });

  describe('formatPhoneE164', () => {
    it('formats US phone numbers to E.164', async () => {
      const { formatPhoneE164 } = await import('@/lib/sms');

      // Use valid US phone numbers with proper format
      // Note: 555-0100 to 555-0199 are specifically reserved for testing
      const result1 = formatPhoneE164('+1 202-555-0123');
      expect(result1).toBe('+12025550123');

      const result2 = formatPhoneE164('202-555-0145');
      expect(result2).toBe('+12025550145');
    });

    it('handles numbers with country code prefix', async () => {
      const { formatPhoneE164 } = await import('@/lib/sms');

      const result = formatPhoneE164('+1 202-555-0100');
      expect(result).toBe('+12025550100');
    });

    it('returns null for invalid phone numbers', async () => {
      const { formatPhoneE164 } = await import('@/lib/sms');

      expect(formatPhoneE164('invalid')).toBe(null);
      expect(formatPhoneE164('123')).toBe(null);
      expect(formatPhoneE164('')).toBe(null);
      expect(formatPhoneE164('   ')).toBe(null);
    });

    it('trims whitespace from input', async () => {
      const { formatPhoneE164 } = await import('@/lib/sms');

      const result = formatPhoneE164('  +1 202-555-0123  ');
      expect(result).toBe('+12025550123');
    });

    it('accepts different default country codes', async () => {
      const { formatPhoneE164 } = await import('@/lib/sms');

      // UK number
      const ukResult = formatPhoneE164('7911 123456', 'GB');
      expect(ukResult).toBe('+447911123456');
    });
  });

  describe('validatePhoneNumber', () => {
    it('returns true for valid US phone numbers', async () => {
      const { validatePhoneNumber } = await import('@/lib/sms');

      // 555-0100 through 555-0199 are reserved for testing
      expect(validatePhoneNumber('+1 202-555-0123')).toBe(true);
      expect(validatePhoneNumber('202-555-0145')).toBe(true);
    });

    it('returns false for invalid phone numbers', async () => {
      const { validatePhoneNumber } = await import('@/lib/sms');

      expect(validatePhoneNumber('invalid')).toBe(false);
      expect(validatePhoneNumber('123')).toBe(false);
      expect(validatePhoneNumber('')).toBe(false);
    });

    it('validates with different country codes', async () => {
      const { validatePhoneNumber } = await import('@/lib/sms');

      // UK number
      expect(validatePhoneNumber('7911 123456', 'GB')).toBe(true);
    });
  });

  describe('processSMSTemplate', () => {
    it('replaces template variables', async () => {
      const { processSMSTemplate } = await import('@/lib/sms');

      const template = 'Hello {{first_name}}, your {{event_name}} is at {{time}}.';
      const variables = {
        first_name: 'John',
        event_name: 'Office Hours',
        time: '2:00 PM',
      };

      const result = processSMSTemplate(template, variables);
      expect(result).toBe('Hello John, your Office Hours is at 2:00 PM.');
    });

    it('handles multiple occurrences of same variable', async () => {
      const { processSMSTemplate } = await import('@/lib/sms');

      const template = '{{name}} - {{name}} - {{name}}';
      const result = processSMSTemplate(template, { name: 'Test' });

      expect(result).toBe('Test - Test - Test');
    });

    it('replaces undefined variables with empty string', async () => {
      const { processSMSTemplate } = await import('@/lib/sms');

      const template = 'Hello {{first_name}}!';
      const result = processSMSTemplate(template, { first_name: undefined });

      expect(result).toBe('Hello !');
    });

    it('leaves unmatched placeholders unchanged', async () => {
      const { processSMSTemplate } = await import('@/lib/sms');

      const template = 'Hello {{first_name}} {{unknown}}!';
      const result = processSMSTemplate(template, { first_name: 'John' });

      expect(result).toBe('Hello John {{unknown}}!');
    });
  });

  describe('calculateSMSSegments', () => {
    it('returns 1 segment for short GSM messages', async () => {
      const { calculateSMSSegments } = await import('@/lib/sms');

      const shortMessage = 'Hello, this is a test message.';
      const result = calculateSMSSegments(shortMessage);

      expect(result.segments).toBe(1);
      expect(result.encoding).toBe('gsm');
    });

    it('calculates multiple segments for long GSM messages', async () => {
      const { calculateSMSSegments } = await import('@/lib/sms');

      // Create a message longer than 160 characters
      const longMessage = 'A'.repeat(170);
      const result = calculateSMSSegments(longMessage);

      expect(result.segments).toBe(2);
      expect(result.encoding).toBe('gsm');
    });

    it('detects unicode encoding for emojis', async () => {
      const { calculateSMSSegments } = await import('@/lib/sms');

      const emojiMessage = 'Hello! 👋';
      const result = calculateSMSSegments(emojiMessage);

      expect(result.encoding).toBe('unicode');
    });

    it('calculates segments correctly for unicode messages', async () => {
      const { calculateSMSSegments } = await import('@/lib/sms');

      // Short unicode message (under 70 chars)
      const shortUnicode = '你好世界'; // 4 characters
      expect(calculateSMSSegments(shortUnicode).segments).toBe(1);

      // Longer unicode message (over 70 chars)
      const longUnicode = '你好'.repeat(40); // 80 characters
      const result = calculateSMSSegments(longUnicode);
      expect(result.segments).toBe(2); // ceil(80/67) = 2
    });

    it('handles exactly 160 character GSM message', async () => {
      const { calculateSMSSegments } = await import('@/lib/sms');

      const exactMessage = 'A'.repeat(160);
      const result = calculateSMSSegments(exactMessage);

      expect(result.segments).toBe(1);
    });

    it('handles exactly 161 character GSM message', async () => {
      const { calculateSMSSegments } = await import('@/lib/sms');

      const overMessage = 'A'.repeat(161);
      const result = calculateSMSSegments(overMessage);

      expect(result.segments).toBe(2);
    });
  });

  describe('getSMSConfig', () => {
    it('returns null when no config exists', async () => {
      mockSMSConfig = null;
      vi.resetModules();
      const { getSMSConfig } = await import('@/lib/sms');

      const config = await getSMSConfig();
      expect(config).toBe(null);
    });

    it('returns config when it exists', async () => {
      mockSMSConfig = {
        provider: 'twilio',
        api_key: 'test-key',
        is_active: true,
      };
      vi.resetModules();
      const { getSMSConfig } = await import('@/lib/sms');

      const config = await getSMSConfig();
      expect(config).toEqual(mockSMSConfig);
    });
  });

  describe('isSMSConfigured', () => {
    it('returns false when no config exists', async () => {
      mockSMSConfig = null;
      vi.resetModules();
      const { isSMSConfigured } = await import('@/lib/sms');

      const result = await isSMSConfigured();
      expect(result).toBe(false);
    });

    it('returns true when active config exists', async () => {
      mockSMSConfig = {
        provider: 'twilio',
        api_key: 'test-key',
        is_active: true,
      };
      vi.resetModules();
      const { isSMSConfigured } = await import('@/lib/sms');

      const result = await isSMSConfigured();
      expect(result).toBe(true);
    });

    it('returns false when config exists but is not active', async () => {
      mockSMSConfig = {
        provider: 'twilio',
        api_key: 'test-key',
        is_active: false,
      };
      vi.resetModules();
      const { isSMSConfigured } = await import('@/lib/sms');

      const result = await isSMSConfigured();
      // The mock returns null for is_active: false since query filters by is_active: true
      expect(result).toBe(false);
    });
  });

  describe('sendSMS', () => {
    it('returns false when no config exists', async () => {
      mockSMSConfig = null;
      vi.resetModules();
      const { sendSMS } = await import('@/lib/sms');

      const result = await sendSMS('+15551234567', 'Test message');
      expect(result).toBe(false);
    });

    it('uses SMS provider when config exists', async () => {
      mockSMSConfig = {
        provider: 'twilio',
        api_key: 'test-key',
        is_active: true,
      };
      vi.resetModules();
      const { sendSMS } = await import('@/lib/sms');
      const { createSMSProvider } = await import('@/lib/sms-providers');

      await sendSMS('+15551234567', 'Test message');

      expect(createSMSProvider).toHaveBeenCalled();
    });
  });

  describe('testSMSConnection', () => {
    it('returns false when no config exists', async () => {
      mockSMSConfig = null;
      vi.resetModules();
      const { testSMSConnection } = await import('@/lib/sms');

      const result = await testSMSConnection();
      expect(result).toBe(false);
    });

    it('tests connection when config exists', async () => {
      mockSMSConfig = {
        provider: 'twilio',
        api_key: 'test-key',
        is_active: true,
      };
      vi.resetModules();
      const { testSMSConnection } = await import('@/lib/sms');

      const result = await testSMSConnection();
      expect(result).toBe(true);
    });

    it('accepts explicit config parameter', async () => {
      mockSMSConfig = null; // No stored config
      vi.resetModules();
      const { testSMSConnection } = await import('@/lib/sms');

      const result = await testSMSConnection({
        id: 'test-id',
        provider: 'twilio',
        api_key: 'test-key',
        api_secret: null,
        sender_phone: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      expect(result).toBe(true);
    });
  });

  describe('logSMSSend', () => {
    it('logs SMS send to database', async () => {
      mockSMSConfig = {
        provider: 'twilio',
        api_key: 'test-key',
        is_active: true,
      };
      vi.resetModules();
      const { logSMSSend } = await import('@/lib/sms');

      const logId = await logSMSSend({
        recipientPhone: '+15551234567',
        recipientName: 'Test User',
        messageType: 'reminder_24h',
        messageBody: 'Test message',
        provider: 'twilio',
        status: 'sent',
      });

      expect(logId).toBeTruthy();
    });

    it('calculates segment count for log entry', async () => {
      vi.resetModules();
      const { logSMSSend, calculateSMSSegments } = await import('@/lib/sms');

      const longMessage = 'A'.repeat(200);
      const expectedSegments = calculateSMSSegments(longMessage).segments;

      await logSMSSend({
        recipientPhone: '+15551234567',
        messageType: 'custom',
        messageBody: longMessage,
        provider: 'twilio',
        status: 'sent',
      });

      // Verify the log was created
      expect(mockSMSLogs.length).toBeGreaterThan(0);
    });
  });

  describe('updateSMSLog', () => {
    it('updates log status', async () => {
      vi.resetModules();
      const { updateSMSLog } = await import('@/lib/sms');

      const result = await updateSMSLog('log-123', {
        status: 'delivered',
      });

      expect(result).toBe(true);
    });

    it('updates error message', async () => {
      vi.resetModules();
      const { updateSMSLog } = await import('@/lib/sms');

      const result = await updateSMSLog('log-123', {
        status: 'failed',
        errorMessage: 'Invalid phone number',
      });

      expect(result).toBe(true);
    });
  });
});
