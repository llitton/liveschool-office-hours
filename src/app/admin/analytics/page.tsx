'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { OHEvent } from '@/types';
import { PageContainer, PageHeader } from '@/components/AppShell';

interface WordCount {
  word: string;
  count: number;
}

interface QuestionAnalytic {
  questionId: string;
  question: string;
  totalResponses: number;
  topWords: WordCount[];
  recentResponses: string[];
}

interface AnalyticsData {
  questionAnalytics: QuestionAnalytic[];
  suggestedTopics: WordCount[];
  totalBookingsAnalyzed: number;
}

export default function AnalyticsPage() {
  const [events, setEvents] = useState<OHEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedEvent]);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events');
      const data = await response.json();
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const url = selectedEvent
        ? `/api/analytics/topics?eventId=${selectedEvent}`
        : '/api/analytics/topics';
      const response = await fetch(url);
      const data = await response.json();
      if (data.error || !data.questionAnalytics) {
        setAnalytics(null);
      } else {
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const hasData = analytics && analytics.totalBookingsAnalyzed > 0;

  return (
    <PageContainer narrow>
        {loading ? (
          <div className="animate-pulse h-32 bg-gray-200 rounded-lg" />
        ) : !hasData ? (
          /* Empty state - concise, action-oriented */
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <h1 className="text-xl font-semibold text-[#101E57] mb-2">
              Know what attendees want before they arrive
            </h1>
            <p className="text-[#667085] mb-6 max-w-md mx-auto">
              Add a booking question to start seeing topic trends and prepare better sessions.
            </p>

            {events.length > 0 ? (
              <Link
                href={`/admin/events/${events[0].id}/settings`}
                className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-5 py-2.5 rounded-lg hover:bg-[#5a5cd0] transition font-medium"
              >
                Add Questions to {events[0].name}
              </Link>
            ) : (
              <Link
                href="/admin/events/new"
                className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-5 py-2.5 rounded-lg hover:bg-[#5a5cd0] transition font-medium"
              >
                Create Event
              </Link>
            )}

            <div className="mt-6 pt-6 border-t border-gray-100">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-[#6F71EE] hover:underline"
              >
                {showPreview ? 'Hide example' : 'See what this looks like'}
              </button>
            </div>

            {showPreview && (
              <div className="mt-4 p-4 bg-[#F6F6F9] rounded-lg text-left">
                <p className="text-xs text-[#667085] uppercase tracking-wide mb-3">Example data</p>
                <div className="space-y-2">
                  {[
                    { topic: 'Student store setup', count: 12 },
                    { topic: 'Points & rewards', count: 9 },
                    { topic: 'Parent access', count: 6 },
                  ].map((item) => (
                    <div key={item.topic} className="flex items-center gap-3">
                      <div className="flex-1 h-5 bg-white rounded overflow-hidden">
                        <div
                          className="h-full bg-[#6F71EE]/30 rounded"
                          style={{ width: `${(item.count / 12) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-[#667085] min-w-[120px]">{item.topic}</span>
                      <span className="text-sm text-[#667085] w-6 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Has data - show analytics */
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-semibold text-[#101E57]">Topic Analytics</h1>
                <p className="text-sm text-[#667085]">
                  {analytics.totalBookingsAnalyzed} booking{analytics.totalBookingsAnalyzed !== 1 ? 's' : ''} analyzed
                </p>
              </div>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              >
                <option value="">All Events</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Suggested Topics */}
            {analytics.suggestedTopics.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <h2 className="text-base font-semibold text-[#101E57] mb-3">Suggested for future sessions</h2>
                <div className="flex flex-wrap gap-2">
                  {analytics.suggestedTopics.map((topic) => (
                    <span
                      key={topic.word}
                      className="px-3 py-1 bg-[#F4B03D]/20 text-[#101E57] rounded-full text-sm"
                    >
                      {topic.word} ({topic.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Question Analysis */}
            {analytics.questionAnalytics.map((qa) => (
              <div
                key={qa.questionId}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-5"
              >
                <h2 className="text-base font-semibold text-[#101E57] mb-1">{qa.question}</h2>
                <p className="text-sm text-[#667085] mb-4">{qa.totalResponses} responses</p>

                {/* Topic tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {qa.topWords.slice(0, 8).map((word) => (
                    <span
                      key={word.word}
                      className="px-3 py-1 bg-[#6F71EE]/10 text-[#6F71EE] rounded-full text-sm"
                    >
                      {word.word} ({word.count})
                    </span>
                  ))}
                </div>

                {/* Recent responses */}
                {qa.recentResponses.length > 0 && (
                  <div className="space-y-2">
                    {qa.recentResponses.slice(0, 3).map((response, i) => (
                      <div key={i} className="text-sm text-[#667085] bg-[#F6F6F9] p-3 rounded-lg">
                        &quot;{response}&quot;
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </PageContainer>
  );
}
