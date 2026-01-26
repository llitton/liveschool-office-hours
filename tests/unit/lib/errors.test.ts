import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeErrorMessage,
  getUserFriendlyError,
  createApiError,
  CommonErrors,
} from '@/lib/errors';

describe('Error Utilities', () => {
  describe('sanitizeErrorMessage', () => {
    it('removes SQL constraint details', () => {
      const message = 'violates unique constraint "oh_events_slug_key"';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).not.toContain('constraint');
      expect(sanitized).not.toContain('oh_events');
    });

    it('removes Key details from constraint errors', () => {
      const message = 'Key (email)=(test@example.com) already exists';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).not.toContain('Key');
      expect(sanitized).not.toContain('email');
      expect(sanitized).not.toContain('test@example.com');
    });

    it('removes DETAIL, HINT, and CONTEXT from messages', () => {
      const message = 'Error occurred DETAIL: some technical info HINT: try something';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).not.toContain('DETAIL');
      expect(sanitized).not.toContain('HINT');
      expect(sanitized).not.toContain('technical info');
    });

    it('replaces column references with "field"', () => {
      const message = 'column "email_address" cannot be null';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).not.toContain('email_address');
      expect(sanitized.toLowerCase()).toContain('field');
    });

    it('replaces table references with "record"', () => {
      const message = 'table "oh_bookings" not found';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).not.toContain('oh_bookings');
      expect(sanitized.toLowerCase()).toContain('record');
    });

    it('removes SQLSTATE codes', () => {
      const message = 'Error message (SQLSTATE 23505)';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).not.toContain('SQLSTATE');
      expect(sanitized).not.toContain('23505');
    });

    it('removes character position info', () => {
      const message = 'Syntax error at character 42';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).not.toContain('character 42');
    });

    it('returns generic message for empty/short results', () => {
      const message = ''; // Would become empty after sanitization
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).toBe('An error occurred. Please try again.');
    });

    it('cleans up extra whitespace', () => {
      const message = 'Error   with    multiple   spaces';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).not.toMatch(/\s{2,}/);
    });

    it('preserves user-friendly messages', () => {
      const message = 'This time slot is no longer available';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).toBe(message);
    });
  });

  describe('getUserFriendlyError', () => {
    it('maps constraint violation (23505) to user-friendly message', () => {
      const error = { code: '23505', message: 'duplicate key value' };
      const result = getUserFriendlyError(error);
      expect(result).toBe('This record already exists. Please try with different values.');
    });

    it('maps foreign key violation (23503) to user-friendly message', () => {
      const error = { code: '23503', message: 'violates foreign key constraint' };
      const result = getUserFriendlyError(error);
      expect(result).toBe('This operation references data that no longer exists.');
    });

    it('maps not null violation (23502) to user-friendly message', () => {
      const error = { code: '23502', message: 'null value in column' };
      const result = getUserFriendlyError(error);
      expect(result).toBe('Required information is missing. Please fill in all required fields.');
    });

    it('maps permission denied (42501) to user-friendly message', () => {
      const error = { code: '42501', message: 'permission denied' };
      const result = getUserFriendlyError(error);
      expect(result).toBe('You do not have permission to perform this action.');
    });

    it('maps authentication failure (28000) to user-friendly message', () => {
      const error = { code: '28000', message: 'authentication failed' };
      const result = getUserFriendlyError(error);
      expect(result).toBe('Authentication failed. Please log in again.');
    });

    it('maps timeout (57014) to user-friendly message', () => {
      const error = { code: '57014', message: 'query_canceled' };
      const result = getUserFriendlyError(error);
      expect(result).toBe('The operation took too long. Please try again.');
    });

    it('maps too many connections (53300) to user-friendly message', () => {
      const error = { code: '53300', message: 'too many connections' };
      const result = getUserFriendlyError(error);
      expect(result).toBe('Too many connections. Please try again in a moment.');
    });

    it('maps data too long (22001) to user-friendly message', () => {
      const error = { code: '22001', message: 'value too long' };
      const result = getUserFriendlyError(error);
      expect(result).toBe('The text entered is too long for this field.');
    });

    it('maps invalid date (22007) to user-friendly message', () => {
      const error = { code: '22007', message: 'invalid datetime format' };
      const result = getUserFriendlyError(error);
      expect(result).toBe('The date format is invalid. Please use a valid date.');
    });

    it('sanitizes message for unknown error codes', () => {
      // Pattern matches "violates [word] constraint" - need a word like "unique" between
      const error = { code: '99999', message: 'column "test" violates unique constraint "test_check"' };
      const result = getUserFriendlyError(error);
      // Column name should be replaced with "field"
      expect(result).not.toContain('test');
      // Constraint details should be replaced
      expect(result).toContain('data validation failed');
    });

    it('returns default message when no code or message', () => {
      const error = {};
      const result = getUserFriendlyError(error);
      expect(result).toBe('An unexpected error occurred. Please try again.');
    });

    it('sanitizes message when only message is provided', () => {
      const error = { message: 'Some user-friendly error message' };
      const result = getUserFriendlyError(error);
      expect(result).toBe('Some user-friendly error message');
    });
  });

  describe('createApiError', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('creates error from Supabase error object', () => {
      const supabaseError = {
        code: '23505',
        message: 'duplicate key value',
        details: 'Key (email)=(test@example.com) already exists',
      };
      const result = createApiError(supabaseError);
      expect(result.error).toBe('This record already exists. Please try with different values.');
    });

    it('creates error from standard Error object', () => {
      const error = new Error('Something went wrong');
      const result = createApiError(error);
      expect(result.error).toBe('Something went wrong');
    });

    it('returns fallback message for unknown error types', () => {
      const result = createApiError(null, 'Custom fallback');
      expect(result.error).toBe('Custom fallback');
    });

    it('includes code and details in development mode', () => {
      process.env.NODE_ENV = 'development';
      const supabaseError = {
        code: '23505',
        message: 'duplicate key',
        details: 'Key already exists',
      };
      const result = createApiError(supabaseError);
      expect(result.code).toBe('23505');
      expect(result.details).toBe('Key already exists');
    });

    it('excludes code and details in production mode', () => {
      process.env.NODE_ENV = 'production';
      const supabaseError = {
        code: '23505',
        message: 'duplicate key',
        details: 'Key already exists',
      };
      const result = createApiError(supabaseError);
      expect(result.code).toBeUndefined();
      expect(result.details).toBeUndefined();
    });

    it('uses default fallback message', () => {
      const result = createApiError(undefined);
      expect(result.error).toBe('An error occurred');
    });
  });

  describe('CommonErrors', () => {
    it('has all expected error messages', () => {
      expect(CommonErrors.UNAUTHORIZED).toBe('Please log in to continue.');
      expect(CommonErrors.FORBIDDEN).toBe('You do not have permission to perform this action.');
      expect(CommonErrors.NOT_FOUND).toBe('The requested resource was not found.');
      expect(CommonErrors.RATE_LIMITED).toBe('Too many requests. Please wait a moment and try again.');
      expect(CommonErrors.NETWORK_ERROR).toBe('Unable to connect. Please check your internet connection.');
      expect(CommonErrors.SERVER_ERROR).toBe('Something went wrong on our end. Please try again.');
      expect(CommonErrors.VALIDATION_ERROR).toBe('Please check your input and try again.');
      expect(CommonErrors.SLOT_FULL).toBe('This time slot is no longer available.');
      expect(CommonErrors.SLOT_CONFLICT).toBe('This time conflicts with another event.');
      expect(CommonErrors.BOOKING_EXISTS).toBe('You have already booked this session.');
      expect(CommonErrors.TOKEN_EXPIRED).toBe('Your session has expired. Please log in again.');
      expect(CommonErrors.CALENDAR_ERROR).toBe('Unable to sync with your calendar. The booking was saved.');
      expect(CommonErrors.EMAIL_ERROR).toBe('Unable to send confirmation email. Please check your bookings.');
    });

    it('all messages are user-friendly (no technical jargon)', () => {
      const technicalTerms = ['sql', 'database', 'query', 'null', 'undefined', 'exception', 'stack'];

      Object.values(CommonErrors).forEach((message) => {
        const lowerMessage = message.toLowerCase();
        technicalTerms.forEach((term) => {
          expect(lowerMessage).not.toContain(term);
        });
      });
    });
  });
});
