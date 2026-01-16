'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { PageContainer, PageHeader } from '@/components/AppShell';
import { Card, CardBody, CardHeader, CalloutCard, EmptyState } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

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
      <Card>
        <CardBody>
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
            <div className="h-32 bg-gray-100 rounded" />
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!event) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <p className="text-[#667085] mb-4">Select a session to manage its questions.</p>
          <LinkButton href="/admin/prepare" variant="tertiary">
            Go back to Prepare
          </LinkButton>
        </CardBody>
      </Card>
    );
  }

  const questions = event.custom_questions || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={event.name}
          description={`${questions.length} question${questions.length !== 1 ? 's' : ''} asked during booking`}
          action={
            <LinkButton href={`/admin/events/${event.id}/settings`} variant="tertiary" size="sm">
              Edit questions
            </LinkButton>
          }
        />

        {questions.length === 0 ? (
          <CardBody className="text-center py-8">
            <div className="w-12 h-12 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-[#101E57] mb-2">No questions yet</h3>
            <p className="text-sm text-[#667085] mb-4 max-w-sm mx-auto">
              Adding questions helps you understand who's booking and what they need.
            </p>
            <LinkButton href={`/admin/events/${event.id}/settings`}>
              Add your first question
            </LinkButton>
          </CardBody>
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
                      {q.required && <Badge variant="error">Required</Badge>}
                    </div>
                    {q.options && q.options.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {q.options.map((opt, i) => (
                          <Badge key={i} variant="count">{opt}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <CalloutCard>
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
      </CalloutCard>
    </div>
  );
}

export default function QuestionsPage() {
  return (
    <>
      <PageContainer narrow>
        <PageHeader
          title="Questions"
          description="What to ask attendees when they book a session."
          backLink={{ href: '/admin/prepare', label: 'Back to Prepare' }}
        />
        <Suspense fallback={<div className="animate-pulse h-48 bg-gray-200 rounded-xl" />}>
          <QuestionsContent />
        </Suspense>
      </PageContainer>
    </>
  );
}
