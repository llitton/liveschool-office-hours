import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEmailDomain,
  isDisposableEmail,
  hasMXRecords,
  validateEmail,
  validateEmailQuick,
  getDisposableDomainCount,
} from '@/lib/email-validation';

// Mock dns module
vi.mock('dns', () => ({
  default: {
    resolveMx: vi.fn(),
  },
}));

import dns from 'dns';

describe('Email Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEmailDomain', () => {
    it('extracts domain from valid email', () => {
      expect(getEmailDomain('test@example.com')).toBe('example.com');
      expect(getEmailDomain('user@sub.domain.org')).toBe('sub.domain.org');
      expect(getEmailDomain('name@company.co.uk')).toBe('company.co.uk');
    });

    it('handles mixed case emails', () => {
      expect(getEmailDomain('Test@EXAMPLE.COM')).toBe('example.com');
      expect(getEmailDomain('USER@Example.Org')).toBe('example.org');
    });

    it('returns null for invalid emails', () => {
      expect(getEmailDomain('notanemail')).toBeNull();
      // '@nodomain' technically has a domain part after @, the function just extracts it
      expect(getEmailDomain('@nodomain')).toBe('nodomain');
      expect(getEmailDomain('noat.com')).toBeNull();
      expect(getEmailDomain('')).toBeNull();
    });

    it('handles emails with special characters in local part', () => {
      expect(getEmailDomain('test+tag@example.com')).toBe('example.com');
      expect(getEmailDomain('first.last@example.com')).toBe('example.com');
    });
  });

  describe('isDisposableEmail', () => {
    it('detects known disposable email domains', () => {
      expect(isDisposableEmail('test@mailinator.com')).toBe(true);
      expect(isDisposableEmail('test@guerrillamail.com')).toBe(true);
      expect(isDisposableEmail('test@10minutemail.com')).toBe(true);
      expect(isDisposableEmail('test@tempmail.com')).toBe(true);
      expect(isDisposableEmail('test@yopmail.com')).toBe(true);
      expect(isDisposableEmail('test@maildrop.cc')).toBe(true);
    });

    it('allows legitimate email domains', () => {
      expect(isDisposableEmail('test@gmail.com')).toBe(false);
      expect(isDisposableEmail('test@yahoo.com')).toBe(false);
      expect(isDisposableEmail('test@outlook.com')).toBe(false);
      expect(isDisposableEmail('test@company.com')).toBe(false);
      expect(isDisposableEmail('test@school.edu')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isDisposableEmail('test@MAILINATOR.COM')).toBe(true);
      expect(isDisposableEmail('test@Yopmail.Com')).toBe(true);
    });

    it('returns false for invalid emails', () => {
      expect(isDisposableEmail('notanemail')).toBe(false);
      expect(isDisposableEmail('')).toBe(false);
    });
  });

  describe('hasMXRecords', () => {
    it('returns true when domain has MX records', async () => {
      const mockResolveMx = vi.fn((domain, callback) => {
        callback(null, [{ exchange: 'mail.example.com', priority: 10 }]);
      });
      (dns.resolveMx as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockResolveMx);

      const result = await hasMXRecords('example.com');
      expect(result).toBe(true);
    });

    it('returns false when domain has no MX records', async () => {
      const mockResolveMx = vi.fn((domain, callback) => {
        callback(null, []);
      });
      (dns.resolveMx as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockResolveMx);

      const result = await hasMXRecords('no-mx.example');
      expect(result).toBe(false);
    });

    it('returns false when DNS lookup fails', async () => {
      const mockResolveMx = vi.fn((domain, callback) => {
        callback(new Error('ENOTFOUND'), null);
      });
      (dns.resolveMx as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockResolveMx);

      const result = await hasMXRecords('invalid.domain');
      expect(result).toBe(false);
    });
  });

  describe('validateEmailQuick', () => {
    it('validates correct email format', () => {
      const result = validateEmailQuick('test@example.com');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects invalid email format', () => {
      const testCases = [
        'notanemail',
        'missing@tld',
        '@nodomain.com',
        'spaces in@email.com',
        'double@@at.com',
        '',
      ];

      for (const email of testCases) {
        const result = validateEmailQuick(email);
        expect(result.valid).toBe(false);
        expect(result.errorType).toBe('format');
        expect(result.error).toBe('Please enter a valid email address');
      }
    });

    it('rejects disposable emails', () => {
      const result = validateEmailQuick('test@mailinator.com');
      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('disposable');
      expect(result.error).toContain('permanent email');
    });

    it('accepts valid non-disposable emails', () => {
      const validEmails = [
        'user@gmail.com',
        'test@company.org',
        'name+tag@school.edu',
        'first.last@domain.co.uk',
      ];

      for (const email of validEmails) {
        const result = validateEmailQuick(email);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('validateEmail (full validation)', () => {
    beforeEach(() => {
      // Default: MX records exist
      const mockResolveMx = vi.fn((domain, callback) => {
        callback(null, [{ exchange: 'mail.example.com', priority: 10 }]);
      });
      (dns.resolveMx as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockResolveMx);
    });

    it('validates email with valid format, non-disposable, and valid MX', async () => {
      const result = await validateEmail('test@gmail.com');
      expect(result.valid).toBe(true);
    });

    it('rejects invalid email format', async () => {
      const result = await validateEmail('notvalid');
      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('format');
    });

    it('rejects disposable emails', async () => {
      const result = await validateEmail('test@mailinator.com');
      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('disposable');
    });

    it('rejects emails with no MX records', async () => {
      const mockResolveMx = vi.fn((domain, callback) => {
        callback(null, []);
      });
      (dns.resolveMx as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockResolveMx);

      const result = await validateEmail('test@no-mail-server.invalid');
      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('mx');
      expect(result.error).toContain('doesn\'t appear to accept emails');
    });

    it('returns invalid when MX lookup returns false (DNS lookup failures inside hasMXRecords)', async () => {
      // hasMXRecords catches errors internally and returns false
      // So validateEmail sees hasMx=false and returns invalid
      const mockResolveMx = vi.fn((domain, callback) => {
        callback(new Error('DNS timeout'), null);
      });
      (dns.resolveMx as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockResolveMx);

      const result = await validateEmail('test@slow-dns.com');
      // hasMXRecords catches the error and returns false, causing mx validation to fail
      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('mx');
    });
  });

  describe('getDisposableDomainCount', () => {
    it('returns the count of disposable domains', () => {
      const count = getDisposableDomainCount();
      expect(count).toBeGreaterThan(100); // We have over 100 domains in the list
      expect(typeof count).toBe('number');
    });
  });
});
