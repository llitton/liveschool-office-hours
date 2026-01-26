import { describe, it, expect } from 'vitest';
import { isTopicQuestion, extractSessionTopics, type SessionTopic } from '@/lib/session-topics';
import type { CustomQuestion, OHBooking } from '@/types';

describe('session-topics', () => {
  describe('isTopicQuestion', () => {
    it('returns true for questions containing "topic"', () => {
      const question: CustomQuestion = {
        id: '1',
        question: 'What topics would you like to discuss?',
        type: 'textarea',
        required: false,
      };
      expect(isTopicQuestion(question)).toBe(true);
    });

    it('returns true for questions containing "discuss"', () => {
      const question: CustomQuestion = {
        id: '1',
        question: 'What would you like to discuss today?',
        type: 'text',
        required: false,
      };
      expect(isTopicQuestion(question)).toBe(true);
    });

    it('returns true for questions containing "help"', () => {
      const question: CustomQuestion = {
        id: '1',
        question: 'How can we help you?',
        type: 'text',
        required: false,
      };
      expect(isTopicQuestion(question)).toBe(true);
    });

    it('returns true for questions containing "question"', () => {
      const question: CustomQuestion = {
        id: '1',
        question: 'Do you have any questions for us?',
        type: 'text',
        required: false,
      };
      expect(isTopicQuestion(question)).toBe(true);
    });

    it('returns true for questions containing "cover"', () => {
      const question: CustomQuestion = {
        id: '1',
        question: 'What would you like us to cover?',
        type: 'text',
        required: false,
      };
      expect(isTopicQuestion(question)).toBe(true);
    });

    it('returns true for textarea type questions', () => {
      const question: CustomQuestion = {
        id: '1',
        question: 'Tell us about yourself',
        type: 'textarea',
        required: false,
      };
      expect(isTopicQuestion(question)).toBe(true);
    });

    it('returns false for non-topic questions', () => {
      const question: CustomQuestion = {
        id: '1',
        question: 'What is your company name?',
        type: 'text',
        required: false,
      };
      expect(isTopicQuestion(question)).toBe(false);
    });

    it('is case-insensitive', () => {
      const question: CustomQuestion = {
        id: '1',
        question: 'WHAT TOPICS INTEREST YOU?',
        type: 'text',
        required: false,
      };
      expect(isTopicQuestion(question)).toBe(true);
    });
  });

  describe('extractSessionTopics', () => {
    const createBooking = (overrides: Partial<OHBooking> = {}): OHBooking => ({
      id: 'booking-1',
      slot_id: 'slot-1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      question_responses: null,
      cancelled_at: null,
      is_waitlisted: false,
      attended_at: null,
      no_show_at: null,
      manage_token: 'token-1',
      created_at: '2026-01-26T10:00:00Z',
      updated_at: '2026-01-26T10:00:00Z',
      reminder_24h_sent_at: null,
      reminder_1h_sent_at: null,
      hubspot_contact_id: null,
      tracking_source: null,
      tracking_utm_source: null,
      tracking_utm_medium: null,
      tracking_utm_campaign: null,
      feedback_rating: null,
      feedback_comment: null,
      feedback_topic_suggestion: null,
      feedback_submitted_at: null,
      feedback_sent_at: null,
      ...overrides,
    });

    it('returns empty array when no bookings have responses', () => {
      const bookings = [createBooking()];
      const result = extractSessionTopics(bookings, null);
      expect(result).toEqual([]);
    });

    it('extracts topics from booking responses', () => {
      const customQuestions: CustomQuestion[] = [
        { id: 'q1', question: 'What topics would you like to discuss?', type: 'textarea', required: true },
      ];
      const bookings = [
        createBooking({
          first_name: 'Alice',
          question_responses: { q1: 'I want to learn about rewards' },
        }),
      ];

      const result = extractSessionTopics(bookings, customQuestions);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'Alice',
        topic: 'I want to learn about rewards',
        questionLabel: 'What topics would you like to discuss?',
      });
    });

    it('extracts topics from multiple bookings', () => {
      const customQuestions: CustomQuestion[] = [
        { id: 'q1', question: 'What would you like to discuss?', type: 'textarea', required: true },
      ];
      const bookings = [
        createBooking({
          id: 'b1',
          first_name: 'Alice',
          question_responses: { q1: 'Topic A' },
        }),
        createBooking({
          id: 'b2',
          first_name: 'Bob',
          email: 'bob@example.com',
          question_responses: { q1: 'Topic B' },
        }),
      ];

      const result = extractSessionTopics(bookings, customQuestions);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
      expect(result[0].topic).toBe('Topic A');
      expect(result[1].name).toBe('Bob');
      expect(result[1].topic).toBe('Topic B');
    });

    it('uses email prefix when first_name is not available', () => {
      const customQuestions: CustomQuestion[] = [
        { id: 'q1', question: 'Help me with', type: 'textarea', required: true },
      ];
      const bookings = [
        createBooking({
          first_name: null,
          email: 'john.doe@company.com',
          question_responses: { q1: 'My question' },
        }),
      ];

      const result = extractSessionTopics(bookings, customQuestions);
      expect(result[0].name).toBe('john.doe');
    });

    it('skips cancelled bookings', () => {
      const customQuestions: CustomQuestion[] = [
        { id: 'q1', question: 'Topics?', type: 'textarea', required: true },
      ];
      const bookings = [
        createBooking({
          first_name: 'Alice',
          question_responses: { q1: 'My topic' },
          cancelled_at: '2026-01-26T12:00:00Z',
        }),
      ];

      const result = extractSessionTopics(bookings, customQuestions);
      expect(result).toHaveLength(0);
    });

    it('skips waitlisted bookings', () => {
      const customQuestions: CustomQuestion[] = [
        { id: 'q1', question: 'Topics?', type: 'textarea', required: true },
      ];
      const bookings = [
        createBooking({
          first_name: 'Alice',
          question_responses: { q1: 'My topic' },
          is_waitlisted: true,
        }),
      ];

      const result = extractSessionTopics(bookings, customQuestions);
      expect(result).toHaveLength(0);
    });

    it('skips empty or whitespace-only responses', () => {
      const customQuestions: CustomQuestion[] = [
        { id: 'q1', question: 'Topics?', type: 'textarea', required: true },
      ];
      const bookings = [
        createBooking({
          first_name: 'Alice',
          question_responses: { q1: '   ' },
        }),
        createBooking({
          id: 'b2',
          first_name: 'Bob',
          question_responses: { q1: '' },
        }),
      ];

      const result = extractSessionTopics(bookings, customQuestions);
      expect(result).toHaveLength(0);
    });

    it('only extracts topic-related questions when custom questions are configured', () => {
      const customQuestions: CustomQuestion[] = [
        { id: 'q1', question: 'What is your company?', type: 'text', required: true },
        { id: 'q2', question: 'What topics interest you?', type: 'textarea', required: false },
      ];
      const bookings = [
        createBooking({
          first_name: 'Alice',
          question_responses: {
            q1: 'Acme Corp',
            q2: 'Learning about features',
          },
        }),
      ];

      const result = extractSessionTopics(bookings, customQuestions);
      // Should only include q2 (topic-related), not q1 (company name)
      expect(result).toHaveLength(1);
      expect(result[0].topic).toBe('Learning about features');
    });

    it('extracts all responses when no custom questions are configured', () => {
      const bookings = [
        createBooking({
          first_name: 'Alice',
          question_responses: {
            q1: 'Response 1',
            q2: 'Response 2',
          },
        }),
      ];

      const result = extractSessionTopics(bookings, null);
      expect(result).toHaveLength(2);
    });

    it('extracts all responses when custom questions array is empty', () => {
      const bookings = [
        createBooking({
          first_name: 'Alice',
          question_responses: {
            q1: 'Response 1',
          },
        }),
      ];

      const result = extractSessionTopics(bookings, []);
      expect(result).toHaveLength(1);
    });

    it('trims whitespace from topics', () => {
      const customQuestions: CustomQuestion[] = [
        { id: 'q1', question: 'Topics?', type: 'textarea', required: true },
      ];
      const bookings = [
        createBooking({
          first_name: 'Alice',
          question_responses: { q1: '  My topic with spaces  ' },
        }),
      ];

      const result = extractSessionTopics(bookings, customQuestions);
      expect(result[0].topic).toBe('My topic with spaces');
    });

    it('handles multiple topic questions per booking', () => {
      const customQuestions: CustomQuestion[] = [
        { id: 'q1', question: 'What topics interest you?', type: 'text', required: true },
        { id: 'q2', question: 'Any questions for us?', type: 'textarea', required: false },
      ];
      const bookings = [
        createBooking({
          first_name: 'Alice',
          question_responses: {
            q1: 'Topic 1',
            q2: 'Question 1',
          },
        }),
      ];

      const result = extractSessionTopics(bookings, customQuestions);
      expect(result).toHaveLength(2);
      expect(result[0].topic).toBe('Topic 1');
      expect(result[1].topic).toBe('Question 1');
    });

    it('includes question label in result', () => {
      const customQuestions: CustomQuestion[] = [
        { id: 'q1', question: 'What would you like to cover today?', type: 'textarea', required: true },
      ];
      const bookings = [
        createBooking({
          first_name: 'Alice',
          question_responses: { q1: 'My topic' },
        }),
      ];

      const result = extractSessionTopics(bookings, customQuestions);
      expect(result[0].questionLabel).toBe('What would you like to cover today?');
    });
  });
});
