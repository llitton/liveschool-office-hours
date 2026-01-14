'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { OHEvent } from '@/types';
import AdminNav from '@/components/AdminNav';

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
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-4">
              <Image
                src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
                alt="LiveSchool"
                width={140}
                height={36}
              />
              <span className="text-[#667085] text-sm font-medium">Connect</span>
            </div>
            <a
              href="/api/auth/logout"
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Sign out
            </a>
          </div>
          <AdminNav />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#101E57]">Topic Analytics</h1>
            <p className="text-[#667085] mt-1">See what topics attendees want to discuss</p>
          </div>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
          >
            <option value="">All Events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-[#667085]">Loading analytics...</div>
        ) : !analytics || analytics.totalBookingsAnalyzed === 0 ? (
          <div className="space-y-6">
            {/* Main Empty State */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-[#6F71EE]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-[#101E57] mb-2">Unlock attendee insights</h3>
                  <p className="text-[#667085] max-w-md mx-auto">
                    Add booking questions to your events to understand what topics attendees want to discuss before they arrive.
                  </p>
                </div>

                {/* Steps to get started */}
                <div className="bg-[#F6F6F9] rounded-lg p-6 mb-6">
                  <h4 className="font-medium text-[#101E57] mb-4">How to start collecting insights:</h4>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
                      <div>
                        <p className="text-[#101E57] font-medium">Add a booking question</p>
                        <p className="text-sm text-[#667085]">Go to any event → Settings → Add a question like &quot;What topics do you want to discuss?&quot;</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                      <div>
                        <p className="text-[#101E57] font-medium">Attendees answer when booking</p>
                        <p className="text-sm text-[#667085]">Their responses are collected automatically with each booking</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                      <div>
                        <p className="text-[#101E57] font-medium">See trends and topics here</p>
                        <p className="text-sm text-[#667085]">We&apos;ll analyze responses and show you the most common themes</p>
                      </div>
                    </li>
                  </ol>
                </div>

                {events.length > 0 ? (
                  <div className="text-center">
                    <Link
                      href={`/admin/events/${events[0].id}/settings`}
                      className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-6 py-3 rounded-lg hover:bg-[#5a5cd0] transition font-medium"
                    >
                      Add questions to {events[0].name}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center">
                    <Link
                      href="/admin/events/new"
                      className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-6 py-3 rounded-lg hover:bg-[#5a5cd0] transition font-medium"
                    >
                      Create your first event
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Example Preview */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-[#667085] uppercase tracking-wide">Preview: What your analytics will look like</h4>
                <span className="text-xs text-[#667085] bg-[#F6F6F9] px-2 py-1 rounded">Sample data</span>
              </div>

              {/* Visual Bar Chart Preview */}
              <div className="mb-6 p-4 bg-[#F6F6F9] rounded-lg">
                <p className="text-sm font-medium text-[#101E57] mb-4">Topic Frequency</p>
                <div className="space-y-3">
                  {[
                    { topic: 'Student store setup', count: 12, percent: 100 },
                    { topic: 'Points & rewards', count: 9, percent: 75 },
                    { topic: 'Parent access', count: 6, percent: 50 },
                    { topic: 'Reports & data', count: 4, percent: 33 },
                    { topic: 'Behavior tracking', count: 3, percent: 25 },
                  ].map((item) => (
                    <div key={item.topic} className="flex items-center gap-3">
                      <span className="w-32 text-sm text-[#667085] truncate">{item.topic}</span>
                      <div className="flex-1 h-6 bg-white rounded overflow-hidden">
                        <div
                          className="h-full bg-[#6F71EE]/40 rounded"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                      <span className="text-sm text-[#667085] w-8 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-[#F6F6F9] rounded-lg p-4">
                  <p className="text-sm font-medium text-[#101E57] mb-3">Topic Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { topic: 'rewards setup', size: 'text-base' },
                      { topic: 'student store', size: 'text-lg font-medium' },
                      { topic: 'points system', size: 'text-sm' },
                      { topic: 'reports', size: 'text-sm' },
                      { topic: 'parent access', size: 'text-base' },
                    ].map((item) => (
                      <span key={item.topic} className={`px-3 py-1 bg-[#6F71EE]/10 text-[#6F71EE] rounded-full ${item.size} opacity-60`}>
                        {item.topic}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-[#F6F6F9] rounded-lg p-4">
                  <p className="text-sm font-medium text-[#101E57] mb-3">Recent Responses</p>
                  <ul className="space-y-2 text-sm text-[#667085] opacity-60">
                    <li className="bg-white p-2 rounded">&quot;Help setting up our student store&quot;</li>
                    <li className="bg-white p-2 rounded">&quot;Questions about the points system&quot;</li>
                    <li className="bg-white p-2 rounded">&quot;How to generate monthly reports&quot;</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <p className="text-[#667085]">
                Analyzed <strong className="text-[#101E57]">{analytics.totalBookingsAnalyzed}</strong> bookings
                with question responses
              </p>
            </div>

            {/* Suggested Topics from Feedback */}
            {analytics.suggestedTopics.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-[#101E57] mb-4">
                  Suggested Topics (from feedback)
                </h2>
                <p className="text-sm text-[#667085] mb-4">
                  Topics attendees have suggested covering in future sessions:
                </p>
                <div className="flex flex-wrap gap-2">
                  {analytics.suggestedTopics.map((topic) => (
                    <span
                      key={topic.word}
                      className="px-3 py-1.5 bg-[#F4B03D]/20 text-[#101E57] rounded-full text-sm font-medium"
                      style={{
                        fontSize: `${Math.min(1 + topic.count * 0.1, 1.5)}rem`,
                      }}
                    >
                      {topic.word}
                      <span className="ml-1 text-[#667085] text-xs">({topic.count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Question-by-Question Analysis */}
            {analytics.questionAnalytics.map((qa) => (
              <div
                key={qa.questionId}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6"
              >
                <h2 className="text-lg font-semibold text-[#101E57] mb-2">
                  {qa.question}
                </h2>
                <p className="text-sm text-[#667085] mb-4">
                  {qa.totalResponses} responses
                </p>

                {/* Word Cloud */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-[#101E57] mb-3">
                    Common Topics
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {qa.topWords.map((word) => (
                      <span
                        key={word.word}
                        className="px-3 py-1 bg-[#6F71EE]/10 text-[#6F71EE] rounded-full text-sm"
                        style={{
                          fontWeight: word.count > 3 ? 600 : 400,
                          opacity: Math.min(0.5 + word.count * 0.1, 1),
                        }}
                      >
                        {word.word}
                        <span className="ml-1 opacity-60">({word.count})</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Recent Responses */}
                <div>
                  <h3 className="text-sm font-medium text-[#101E57] mb-3">
                    Recent Responses
                  </h3>
                  <ul className="space-y-2">
                    {qa.recentResponses.slice(0, 5).map((response, i) => (
                      <li
                        key={i}
                        className="text-sm text-[#667085] bg-[#F6F6F9] p-3 rounded-lg"
                      >
                        &quot;{response}&quot;
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
