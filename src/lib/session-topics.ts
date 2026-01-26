/**
 * Utility functions for extracting session topics from booking question responses
 */

import type { CustomQuestion, OHBooking } from '@/types';

export interface SessionTopic {
  name: string;
  topic: string;
  questionLabel?: string;
}

/**
 * Determines if a question is likely asking about topics/discussion items
 * based on keywords in the question text or if it's a textarea type.
 */
export function isTopicQuestion(question: CustomQuestion): boolean {
  const lowerQuestion = question.question.toLowerCase();
  return (
    lowerQuestion.includes('topic') ||
    lowerQuestion.includes('discuss') ||
    lowerQuestion.includes('help') ||
    lowerQuestion.includes('question') ||
    lowerQuestion.includes('cover') ||
    question.type === 'textarea'
  );
}

/**
 * Extracts topics from bookings based on their question responses.
 * Returns an array of topics with the attendee name and their response.
 *
 * @param bookings - Array of bookings for a slot
 * @param customQuestions - The event's custom questions configuration
 * @returns Array of session topics with attendee info
 */
export function extractSessionTopics(
  bookings: OHBooking[],
  customQuestions: CustomQuestion[] | null
): SessionTopic[] {
  const topicsWithAttendees: SessionTopic[] = [];

  // Get IDs of topic-related questions
  const topicQuestionIds = customQuestions
    ?.filter(q => isTopicQuestion(q))
    .map(q => q.id) || [];

  bookings.forEach(booking => {
    // Skip cancelled, waitlisted, or bookings without responses
    if (!booking.question_responses || booking.cancelled_at || booking.is_waitlisted) {
      return;
    }

    const name = booking.first_name || booking.email.split('@')[0];

    Object.entries(booking.question_responses).forEach(([questionId, response]) => {
      if (!response || !response.trim()) {
        return;
      }

      // Find the question label
      const question = customQuestions?.find(q => q.id === questionId);
      const isTopicRelated = topicQuestionIds.includes(questionId);

      // Include if it's a topic question, or if there are no custom questions configured
      if (isTopicRelated || !customQuestions || customQuestions.length === 0) {
        topicsWithAttendees.push({
          name,
          topic: response.trim(),
          questionLabel: question?.question,
        });
      }
    });
  });

  return topicsWithAttendees;
}
