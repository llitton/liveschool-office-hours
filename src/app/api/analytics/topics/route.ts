import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// GET topic analytics from question responses
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const eventId = searchParams.get('eventId');

  const supabase = getServiceSupabase();

  // Build query
  let query = supabase
    .from('oh_bookings')
    .select(`
      question_responses,
      feedback_comment,
      created_at,
      slot:oh_slots(
        event_id,
        event:oh_events(id, name, custom_questions)
      )
    `)
    .not('question_responses', 'is', null);

  // Get all bookings with responses
  const { data: bookings, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by event if specified
  let filteredBookings = bookings || [];
  if (eventId) {
    filteredBookings = filteredBookings.filter((b) => {
      const slotData = b.slot as { event_id?: string } | null;
      return slotData?.event_id === eventId;
    });
  }

  // Analyze topics by question
  const questionAnalytics: Record<string, {
    question: string;
    responses: string[];
    wordFrequency: Record<string, number>;
  }> = {};

  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'it', 'as', 'be', 'are', 'was', 'were',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
    'these', 'those', 'i', 'we', 'you', 'he', 'she', 'they', 'my', 'your',
    'our', 'their', 'what', 'how', 'when', 'where', 'why', 'who', 'which',
    'about', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'from', 'up', 'down', 'out', 'off', 'over', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'all', 'each', 'few',
    'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'also', 'now', 'any', 'both', 'each',
  ]);

  for (const booking of filteredBookings) {
    const responses = booking.question_responses as Record<string, string>;
    const slotData = booking.slot as { event?: { id: string; name: string; custom_questions: unknown[] }[] } | null;
    const eventArray = slotData?.event;
    const event = Array.isArray(eventArray) ? eventArray[0] : eventArray;

    if (!responses || !event) continue;

    // Get custom questions to map IDs to question text
    const customQuestions = (event.custom_questions || []) as Array<{
      id: string;
      question: string;
    }>;

    for (const [questionId, response] of Object.entries(responses)) {
      if (typeof response !== 'string' || !response.trim()) continue;

      // Find the question text
      const questionConfig = customQuestions.find((q) => q.id === questionId);
      const questionText = questionConfig?.question || questionId;

      // Initialize if needed
      if (!questionAnalytics[questionId]) {
        questionAnalytics[questionId] = {
          question: questionText,
          responses: [],
          wordFrequency: {},
        };
      }

      questionAnalytics[questionId].responses.push(response);

      // Extract words for frequency analysis
      const words = response
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((word) => word.length > 2 && !stopWords.has(word));

      for (const word of words) {
        questionAnalytics[questionId].wordFrequency[word] =
          (questionAnalytics[questionId].wordFrequency[word] || 0) + 1;
      }
    }
  }

  // Also analyze feedback comments for topic suggestions
  const feedbackTopics: Record<string, number> = {};
  for (const booking of filteredBookings) {
    const comment = booking.feedback_comment;
    if (!comment || typeof comment !== 'string') continue;

    // Look for "topics for next time" section
    const topicsMatch = comment.match(/topics for next time:\s*(.+)/i);
    if (topicsMatch) {
      const topicsText = topicsMatch[1];
      const words = topicsText
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((word) => word.length > 2 && !stopWords.has(word));

      for (const word of words) {
        feedbackTopics[word] = (feedbackTopics[word] || 0) + 1;
      }
    }
  }

  // Format output
  const formattedAnalytics = Object.entries(questionAnalytics).map(
    ([id, data]) => ({
      questionId: id,
      question: data.question,
      totalResponses: data.responses.length,
      topWords: Object.entries(data.wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word, count]) => ({ word, count })),
      recentResponses: data.responses.slice(-10),
    })
  );

  const suggestedTopics = Object.entries(feedbackTopics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  return NextResponse.json({
    questionAnalytics: formattedAnalytics,
    suggestedTopics,
    totalBookingsAnalyzed: filteredBookings.length,
  });
}
