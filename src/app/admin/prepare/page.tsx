'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell, { PageContainer, PageHeader, TwoColumnLayout } from '@/components/AppShell';
import { Card, CardHeader, CardBody, LinkCard, CalloutCard, EmptyState } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';

interface Event {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  custom_questions: { id: string; question: string }[] | null;
  host_name: string;
  duration_minutes: number;
  confirmation_subject: string | null;
  reminder_subject: string | null;
}

interface ReadinessItem {
  id: string;
  label: string;
  incompleteHelper: string;
  completeHelper: string;
  isComplete: boolean;
  href: string;
}

export default function PreparePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch('/api/events');
        const data = await res.json();
        setEvents(data);
        if (data.length > 0) {
          setSelectedEventId(data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchEvents();
  }, []);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const getReadinessItems = (event: Event | undefined): ReadinessItem[] => {
    if (!event) return [];

    const hasDescription = !!event.description && event.description.trim().length > 0;
    const hasQuestions = !!(event.custom_questions && event.custom_questions.length > 0);
    const hasHost = !!event.host_name;
    const hasMessaging = !!event.confirmation_subject || !!event.reminder_subject;

    return [
      {
        id: 'description',
        label: 'Session description is set',
        incompleteHelper: 'Add a description so attendees know what to expect.',
        completeHelper: 'Attendees will see this when booking.',
        isComplete: hasDescription,
        href: `/admin/events/${event.id}/settings`,
      },
      {
        id: 'questions',
        label: 'Booking questions are ready',
        incompleteHelper: 'Add at least one question to understand who\'s booking and why.',
        completeHelper: `${event.custom_questions?.length || 0} question(s) will be shown during booking.`,
        isComplete: hasQuestions,
        href: `/admin/prepare/questions?event=${event.id}`,
      },
      {
        id: 'host',
        label: 'Host is assigned',
        incompleteHelper: 'Choose who will lead this session.',
        completeHelper: `Hosted by ${event.host_name}.`,
        isComplete: hasHost,
        href: `/admin/prepare/logistics?event=${event.id}`,
      },
      {
        id: 'messaging',
        label: 'Attendee messaging is ready',
        incompleteHelper: 'Review confirmation and reminder messages before going live.',
        completeHelper: 'Attendees will receive clear instructions and reminders.',
        isComplete: hasMessaging,
        href: `/admin/prepare/messaging?event=${event.id}`,
      },
    ];
  };

  const readinessItems = getReadinessItems(selectedEvent);
  const completedCount = readinessItems.filter(item => item.isComplete).length;
  const totalCount = readinessItems.length;
  const allComplete = completedCount === totalCount && totalCount > 0;

  const getConfidenceLevel = () => {
    if (totalCount === 0) return { label: 'Select a session', helper: 'Choose a session to see its preparation status.' };
    if (completedCount === 0) return { label: 'Preparation in progress', helper: 'Adding a bit more detail will help this session run smoothly.' };
    if (completedCount === 1) return { label: 'Preparation in progress', helper: 'Adding a bit more detail will help this session run smoothly.' };
    if (completedCount === 2) return { label: 'Good foundation', helper: 'The essentials are here. A quick review will tighten things up.' };
    if (completedCount === 3) return { label: 'Nearly ready', helper: 'Everything important is in place. One last check before going live.' };
    return { label: 'Ready to run', helper: 'Attendees will have clear expectations and instructions.' };
  };

  const confidence = getConfidenceLevel();

  if (isLoading) {
    return (
      <AppShell>
        <PageContainer>
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-96 mb-8" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  if (events.length === 0) {
    return (
      <AppShell>
        <PageContainer narrow>
          <EmptyState
            icon={
              <svg className="w-7 h-7 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            title="Prepare your sessions"
            description="Set expectations, gather the right information, and make each session run smoothly. Create your first session to get started."
            action={
              <LinkButton href="/admin/events/new">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create your first session
              </LinkButton>
            }
          />
        </PageContainer>
      </AppShell>
    );
  }

  const mainContent = (
    <div className="space-y-6">
      {/* Event selector */}
      <div className="max-w-md">
        <Select
          label="Select a session to prepare"
          value={selectedEventId || ''}
          onChange={(e) => setSelectedEventId(e.target.value)}
          options={events.map(event => ({ value: event.id, label: event.name }))}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <LinkCard href={`/admin/prepare/agenda?event=${selectedEventId}`} padding="md">
          <div className="w-10 h-10 rounded-lg bg-[#6F71EE]/10 flex items-center justify-center mb-3 group-hover:bg-[#6F71EE]/20 transition">
            <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h3 className="font-semibold text-[#101E57] mb-1 group-hover:text-[#6F71EE] transition">Agenda</h3>
          <p className="text-sm text-[#667085]">Plan what will happen in this session</p>
        </LinkCard>

        <LinkCard href={`/admin/prepare/questions?event=${selectedEventId}`} padding="md">
          <div className="w-10 h-10 rounded-lg bg-[#6F71EE]/10 flex items-center justify-center mb-3 group-hover:bg-[#6F71EE]/20 transition">
            <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-[#101E57] mb-1 group-hover:text-[#6F71EE] transition">Questions</h3>
          <p className="text-sm text-[#667085]">What to ask attendees when booking</p>
        </LinkCard>

        <LinkCard href={`/admin/prepare/logistics?event=${selectedEventId}`} padding="md">
          <div className="w-10 h-10 rounded-lg bg-[#6F71EE]/10 flex items-center justify-center mb-3 group-hover:bg-[#6F71EE]/20 transition">
            <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-[#101E57] mb-1 group-hover:text-[#6F71EE] transition">Logistics</h3>
          <p className="text-sm text-[#667085]">Host, capacity, and technical setup</p>
        </LinkCard>

        <LinkCard href={`/admin/prepare/messaging?event=${selectedEventId}`} padding="md">
          <div className="w-10 h-10 rounded-lg bg-[#6F71EE]/10 flex items-center justify-center mb-3 group-hover:bg-[#6F71EE]/20 transition">
            <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-[#101E57] mb-1 group-hover:text-[#6F71EE] transition">Messaging</h3>
          <p className="text-sm text-[#667085]">Confirmation and reminder emails</p>
        </LinkCard>
      </div>

      {/* Session preview card */}
      {selectedEvent && (
        <Card>
          <CardHeader
            title="Session preview"
            action={
              <Link
                href={`/book/${selectedEvent.slug}`}
                target="_blank"
                className="text-sm text-[#6F71EE] hover:text-[#5B5DD6] font-medium flex items-center gap-1"
              >
                Preview as attendee
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            }
          />
          <CardBody>
            <h3 className="text-lg font-semibold text-[#101E57] mb-2">{selectedEvent.name}</h3>
            {selectedEvent.description ? (
              <div
                className="text-[#667085] text-sm mb-4 prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0"
                dangerouslySetInnerHTML={{ __html: selectedEvent.description }}
              />
            ) : (
              <p className="text-[#667085] text-sm mb-4 italic">
                No description added yet. Add one to help attendees know what to expect.
              </p>
            )}
            <div className="flex items-center gap-4 text-sm text-[#667085]">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {selectedEvent.duration_minutes} minutes
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {selectedEvent.host_name}
              </span>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );

  const sidebar = (
    <Card className="sticky top-24">
      <div className="px-5 py-4 border-b border-[#E0E0E0]">
        <h2 className="font-semibold text-[#101E57] mb-1">Session readiness</h2>
        <p className="text-sm text-[#667085]">
          Make sure everything your attendees will experience is ready to go.
        </p>
      </div>

      {/* Confidence indicator */}
      <div className="px-5 py-4 border-b border-[#E0E0E0]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#101E57]">{confidence.label}</span>
          <span className="text-sm text-[#667085]">{completedCount} of {totalCount}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              allComplete ? 'bg-[#059669]' : 'bg-[#6F71EE]'
            }`}
            style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
        <p className="text-xs text-[#667085] mt-2">{confidence.helper}</p>
      </div>

      {/* Checklist */}
      <div className="divide-y divide-[#E0E0E0]">
        {readinessItems.map(item => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-start gap-3 px-5 py-4 hover:bg-[#FAFAFA] transition"
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              item.isComplete ? 'bg-[#059669]' : 'bg-[#FEF3C7]'
            }`}>
              {item.isComplete ? (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <div className="w-2 h-2 rounded-full bg-[#D97706]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${item.isComplete ? 'text-[#667085]' : 'text-[#101E57]'}`}>
                {item.label}
              </p>
              <p className="text-xs text-[#667085] mt-0.5">
                {item.isComplete ? item.completeHelper : item.incompleteHelper}
              </p>
            </div>
            <svg className="w-4 h-4 text-[#98A2B3] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>

      {/* Guidance */}
      <div className="px-5 py-4 bg-[#FAFAFA] border-t border-[#E0E0E0]">
        <h3 className="text-xs font-medium text-[#667085] uppercase tracking-wide mb-2">
          What great sessions have in common
        </h3>
        <ul className="space-y-1.5 text-xs text-[#667085]">
          <li className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-[#667085]" />
            A clear agenda
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-[#667085]" />
            One to three thoughtful questions
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-[#667085]" />
            Simple, friendly instructions
          </li>
        </ul>
        <p className="text-xs text-[#98A2B3] mt-3">
          You don&apos;t need everything perfect. You just need enough clarity.
        </p>
      </div>
    </Card>
  );

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Prepare"
          description="Everything your attendees will experience before, during, and after each session."
        />
        <TwoColumnLayout main={mainContent} sidebar={sidebar} />
      </PageContainer>
    </AppShell>
  );
}
