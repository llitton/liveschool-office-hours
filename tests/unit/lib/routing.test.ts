import { describe, it, expect } from 'vitest';
import {
  evaluateRules,
  encodeResponses,
  decodeResponses,
  generateSlug,
} from '@/lib/routing';
import { OHRoutingRule } from '@/types';

describe('Routing Utilities', () => {
  describe('evaluateRules', () => {
    const createRule = (overrides: Partial<OHRoutingRule> = {}): OHRoutingRule => ({
      id: `rule-${Math.random().toString(36).substr(2, 9)}`,
      form_id: 'form-123',
      question_id: 'q1',
      answer_value: 'yes',
      target_event_id: 'event-abc',
      target_host_id: null,
      priority: 1,
      is_active: true,
      created_at: '2026-01-25T00:00:00Z',
      ...overrides,
    });

    it('returns matching rule target when response matches', () => {
      const rules = [
        createRule({
          question_id: 'q1',
          answer_value: 'enterprise',
          target_event_id: 'enterprise-event',
          target_host_id: 'host-enterprise',
        }),
      ];

      const responses = { q1: 'enterprise' };
      const result = evaluateRules(rules, responses, 'default-event');

      expect(result.eventId).toBe('enterprise-event');
      expect(result.hostId).toBe('host-enterprise');
    });

    it('returns default when no rules match', () => {
      const rules = [
        createRule({
          question_id: 'q1',
          answer_value: 'enterprise',
          target_event_id: 'enterprise-event',
        }),
      ];

      const responses = { q1: 'startup' };
      const result = evaluateRules(rules, responses, 'default-event');

      expect(result.eventId).toBe('default-event');
      expect(result.hostId).toBeNull();
    });

    it('returns default when rules array is empty', () => {
      const result = evaluateRules([], { q1: 'anything' }, 'default-event');

      expect(result.eventId).toBe('default-event');
      expect(result.hostId).toBeNull();
    });

    it('prioritizes rules by priority (lower = higher priority)', () => {
      const rules = [
        createRule({
          question_id: 'q1',
          answer_value: 'yes',
          target_event_id: 'low-priority-event',
          priority: 10,
        }),
        createRule({
          question_id: 'q1',
          answer_value: 'yes',
          target_event_id: 'high-priority-event',
          priority: 1,
        }),
      ];

      const responses = { q1: 'yes' };
      const result = evaluateRules(rules, responses, 'default-event');

      expect(result.eventId).toBe('high-priority-event');
    });

    it('ignores inactive rules', () => {
      const rules = [
        createRule({
          question_id: 'q1',
          answer_value: 'yes',
          target_event_id: 'inactive-event',
          is_active: false,
          priority: 1,
        }),
        createRule({
          question_id: 'q1',
          answer_value: 'yes',
          target_event_id: 'active-event',
          is_active: true,
          priority: 2,
        }),
      ];

      const responses = { q1: 'yes' };
      const result = evaluateRules(rules, responses, 'default-event');

      expect(result.eventId).toBe('active-event');
    });

    it('performs case-insensitive matching', () => {
      const rules = [
        createRule({
          question_id: 'q1',
          answer_value: 'ENTERPRISE',
          target_event_id: 'enterprise-event',
        }),
      ];

      const responses = { q1: 'enterprise' };
      const result = evaluateRules(rules, responses, 'default-event');

      expect(result.eventId).toBe('enterprise-event');
    });

    it('trims whitespace when matching', () => {
      const rules = [
        createRule({
          question_id: 'q1',
          answer_value: '  yes  ',
          target_event_id: 'yes-event',
        }),
      ];

      const responses = { q1: '  yes  ' };
      const result = evaluateRules(rules, responses, 'default-event');

      expect(result.eventId).toBe('yes-event');
    });

    it('handles missing question in responses', () => {
      const rules = [
        createRule({
          question_id: 'q1',
          answer_value: 'yes',
          target_event_id: 'yes-event',
        }),
      ];

      const responses = { q2: 'yes' }; // Different question
      const result = evaluateRules(rules, responses, 'default-event');

      expect(result.eventId).toBe('default-event');
    });

    it('evaluates multiple questions correctly', () => {
      const rules = [
        createRule({
          question_id: 'company_size',
          answer_value: 'enterprise',
          target_event_id: 'enterprise-event',
          priority: 1,
        }),
        createRule({
          question_id: 'industry',
          answer_value: 'education',
          target_event_id: 'education-event',
          priority: 2,
        }),
      ];

      // First matching rule wins (by priority)
      const responses = {
        company_size: 'enterprise',
        industry: 'education',
      };
      const result = evaluateRules(rules, responses, 'default-event');

      expect(result.eventId).toBe('enterprise-event');
    });

    it('returns null hostId when rule has no target_host_id', () => {
      const rules = [
        createRule({
          question_id: 'q1',
          answer_value: 'yes',
          target_event_id: 'event-123',
          target_host_id: null,
        }),
      ];

      const responses = { q1: 'yes' };
      const result = evaluateRules(rules, responses, 'default-event');

      expect(result.hostId).toBeNull();
    });
  });

  describe('encodeResponses', () => {
    it('encodes responses to base64', () => {
      const responses = { q1: 'hello', q2: 'world' };
      const encoded = encodeResponses(responses);

      // Should be valid base64
      expect(() => atob(encoded)).not.toThrow();
    });

    it('produces decodeable output', () => {
      const responses = { q1: 'hello', q2: 'world' };
      const encoded = encodeResponses(responses);
      const decoded = JSON.parse(atob(encoded));

      expect(decoded).toEqual(responses);
    });

    it('handles empty responses', () => {
      const encoded = encodeResponses({});
      const decoded = JSON.parse(atob(encoded));

      expect(decoded).toEqual({});
    });

    it('handles special characters', () => {
      const responses = {
        q1: 'Hello, World!',
        q2: 'Question & Answer',
        q3: 'Line 1\nLine 2',
      };
      const encoded = encodeResponses(responses);
      const decoded = JSON.parse(atob(encoded));

      expect(decoded).toEqual(responses);
    });

    it('handles ASCII-safe special characters', () => {
      // Note: btoa() doesn't support Unicode in Node.js environments
      // This test verifies ASCII-safe special characters work
      const responses = {
        q1: 'Hello World!',
        q2: 'Test@123',
      };
      const encoded = encodeResponses(responses);
      const decoded = JSON.parse(atob(encoded));

      expect(decoded).toEqual(responses);
    });
  });

  describe('decodeResponses', () => {
    it('decodes valid base64 encoded responses', () => {
      const original = { q1: 'hello', q2: 'world' };
      const encoded = btoa(JSON.stringify(original));
      const decoded = decodeResponses(encoded);

      expect(decoded).toEqual(original);
    });

    it('returns null for invalid base64', () => {
      const result = decodeResponses('not-valid-base64!!!');

      expect(result).toBeNull();
    });

    it('returns null for valid base64 but invalid JSON', () => {
      const encoded = btoa('not json');
      const result = decodeResponses(encoded);

      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      const result = decodeResponses('');

      expect(result).toBeNull();
    });

    it('handles complex nested objects', () => {
      const original = {
        q1: 'simple',
        q2: { nested: true },
      };
      const encoded = btoa(JSON.stringify(original));
      const decoded = decodeResponses(encoded);

      expect(decoded).toEqual(original);
    });
  });

  describe('generateSlug', () => {
    it('converts name to lowercase', () => {
      const slug = generateSlug('UPPERCASE');

      expect(slug).toBe('uppercase');
    });

    it('replaces spaces with hyphens', () => {
      const slug = generateSlug('Office Hours');

      expect(slug).toBe('office-hours');
    });

    it('replaces multiple spaces with single hyphen', () => {
      const slug = generateSlug('Office   Hours   Session');

      expect(slug).toBe('office-hours-session');
    });

    it('removes special characters', () => {
      const slug = generateSlug('Q&A Session!');

      expect(slug).toBe('q-a-session');
    });

    it('removes leading and trailing hyphens', () => {
      const slug = generateSlug('---Office Hours---');

      expect(slug).toBe('office-hours');
    });

    it('handles numbers', () => {
      const slug = generateSlug('Session 123');

      expect(slug).toBe('session-123');
    });

    it('handles complex names', () => {
      const slug = generateSlug("Laura's Q&A - Weekly Office Hours!");

      expect(slug).toBe('laura-s-q-a-weekly-office-hours');
    });

    it('handles empty string', () => {
      const slug = generateSlug('');

      expect(slug).toBe('');
    });

    it('handles string with only special characters', () => {
      const slug = generateSlug('!!!@@@###');

      expect(slug).toBe('');
    });

    it('preserves consecutive alphanumeric characters', () => {
      const slug = generateSlug('ABC123DEF');

      expect(slug).toBe('abc123def');
    });
  });
});
