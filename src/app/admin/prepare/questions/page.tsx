'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import AdminHeader from '@/components/AdminHeader';

interface CustomQuestion {
  id: string;
  question: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface Event {
  id: string;
  name: string;
  slug: string;
  custom_questions: CustomQuestion[] | null;
}

function QuestionsContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) {
      fetch(`/api/events/${eventId}`)
        .then(res => res.json())
        .then(data => {
          setEvent(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [eventId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E0E0E0] p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
        <div className="h-32 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-white rounded-xl border border-[#E0E0E0] p-8 text-center">
        <p className="text-[#667085]">Select a session to manage its questions.</p>
        <Link href="/admin/prepare" className="text-[#6F71EE] font-medium hover:underline mt-2 inline-block">
          Go back to Prepare
        </Link>
      </div>
    );
  }

  const questions = event.custom_questions || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E0E0E0] flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[#101E57]">{event.name}</h2>
            <p className="text-sm text-[#667085]">
              {questions.length} question{questions.length !== 1 ? 's' : ''} asked during booking
            </p>
          </div>
          <Link
            href={`/admin/events/${event.id}/settings`}
            className="text-sm text-[#6F71EE] hover:underline font-medium"
          >
            Edit questions
          </Link>
        </div>

        {questions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-[#101E57] mb-2">No questions yet</h3>
            <p className="text-sm text-[#667085] mb-4 max-w-sm mx-auto">
              Adding questions helps you understand who's booking and what they need.
            </p>
            <Link
              href={`/admin/events/${event.id}/settings`}
              className="inline-flex items-center gap-2 bg-[#101E57] text-white px-5 py-2.5 rounded-lg font-medium hover:bg-[#1a2d6e] transition"
            >
              Add your first question
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#E0E0E0]">
            {questions.map((q, index) => (
              <div key={q.id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-[#6F71EE]/10 text-[#6F71EE] rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-[#101E57]">{q.question}</p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-[#667085]">
                      <span className="capitalize">{q.type}</span>
                      {q.required && (
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-xs rounded">Required</span>
                      )}
                    </div>
                    {q.options && q.options.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {q.options.map((opt, i) => (
                          <span key={i} className="px-2 py-1 bg-[#F6F6F9] text-[#667085] text-xs rounded">
                            {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#FAFAFA] rounded-xl border border-[#E0E0E0] p-5">
        <h3 className="font-medium text-[#101E57] mb-2">Tips for great questions</h3>
        <ul className="space-y-2 text-sm text-[#667085]">
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE] mt-1">•</span>
            Ask about goals, not logistics. "What do you hope to learn?" beats "What's your role?"
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE] mt-1">•</span>
            Keep it short. 1-3 questions is usually enough.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE] mt-1">•</span>
            Use open text for context, multiple choice for categorization.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function QuestionsPage() {
  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <AdminHeader email="" />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin/prepare" className="text-sm text-[#6F71EE] hover:underline flex items-center gap-1 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Prepare
          </Link>
          <h1 className="text-2xl font-bold text-[#101E57] mb-2">Questions</h1>
          <p className="text-[#667085]">
            What to ask attendees when they book a session.
          </p>
        </div>

        <Suspense fallback={<div className="animate-pulse h-48 bg-gray-200 rounded" />}>
          <QuestionsContent />
        </Suspense>
      </main>
    </div>
  );
}
