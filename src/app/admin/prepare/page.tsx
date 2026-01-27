'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { PageContainer, PageHeader } from '@/components/AppShell';
import { Card, CardBody, EmptyState } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';

interface Booking {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  question_responses: Record<string, string> | null;
  status: string;
}

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
  google_meet_link: string | null;
  bookings: Booking[];
  event: {
    id: string;
    name: string;
    slug: string;
    meeting_type: string;
    duration_minutes: number;
    host_name: string;
    description: string | null;
    custom_questions: { id: string; question: string; type: string }[] | null;
  };
}

interface GroupedSessions {
  [date: string]: Slot[];
}

export default function UpcomingPage() {
  const [sessions, setSessions] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [daysAhead, setDaysAhead] = useState(7);

  useEffect(() => {
    async function fetchUpcomingSessions() {
      try {
        const res = await fetch(`/api/admin/upcoming-sessions?days=${daysAhead}`);
        if (!res.ok) throw new Error('Failed to fetch');

        const data = await res.json();
        // Filter to only slots with at least one confirmed booking
        const withBookings = data.filter((slot: Slot) =>
          slot.bookings && slot.bookings.some((b: Booking) => b.status === 'confirmed')
        );
        setSessions(withBookings);
      } catch (error) {
        console.error('Failed to fetch upcoming sessions:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUpcomingSessions();
  }, [daysAhead]);

  // Group sessions by date
  const groupedSessions: GroupedSessions = sessions.reduce((acc, slot) => {
    const date = format(parseISO(slot.start_time), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(slot);
    return acc;
  }, {} as GroupedSessions);

  const sortedDates = Object.keys(groupedSessions).sort();

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMMM d');
  };

  const getQuestionLabel = (questionId: string, questions: { id: string; question: string }[] | null) => {
    if (!questions) return questionId;
    const q = questions.find(q => q.id === questionId);
    return q?.question || questionId;
  };

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader
          title="Upcoming"
          description="Your scheduled sessions for the next week"
        />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-32 mb-3" />
              <div className="h-32 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </PageContainer>
    );
  }

  if (sessions.length === 0) {
    return (
      <PageContainer>
        <PageHeader
          title="Upcoming"
          description="Your scheduled sessions for the next week"
        />
        <EmptyState
          icon={
            <svg className="w-7 h-7 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          title="No upcoming sessions"
          description={`You don't have any confirmed bookings in the next ${daysAhead} days. When someone books a session, it will appear here.`}
          action={
            <LinkButton href="/admin">
              View all events
            </LinkButton>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Upcoming"
        description="Your scheduled sessions and what attendees want to discuss"
      />

      {/* Time range selector */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-[#667085]">Show next</span>
        <select
          value={daysAhead}
          onChange={(e) => setDaysAhead(Number(e.target.value))}
          className="px-3 py-1.5 border border-[#E0E0E0] rounded-lg text-sm text-[#101E57] bg-white focus:outline-none focus:ring-2 focus:ring-[#6F71EE]/20 focus:border-[#6F71EE]"
        >
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>

      {/* Sessions grouped by date */}
      <div className="space-y-8">
        {sortedDates.map(date => (
          <div key={date}>
            {/* Date header */}
            <h2 className={`text-sm font-semibold mb-3 ${
              isToday(parseISO(date))
                ? 'text-[#6F71EE]'
                : 'text-[#667085]'
            }`}>
              {getDateLabel(date)}
            </h2>

            {/* Sessions for this date */}
            <div className="space-y-4">
              {groupedSessions[date]
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                .map(slot => {
                  const confirmedBookings = slot.bookings.filter(b => b.status === 'confirmed');
                  const isWebinar = slot.event.meeting_type === 'webinar';

                  return (
                    <Card key={slot.id} className="overflow-hidden">
                      {/* Session header */}
                      <div className="px-5 py-4 border-b border-[#E0E0E0] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Time */}
                          <div className="text-center min-w-[60px]">
                            <div className="text-lg font-semibold text-[#101E57]">
                              {format(parseISO(slot.start_time), 'h:mm')}
                            </div>
                            <div className="text-xs text-[#667085] uppercase">
                              {format(parseISO(slot.start_time), 'a')}
                            </div>
                          </div>

                          <div className="h-10 w-px bg-[#E0E0E0]" />

                          {/* Event info */}
                          <div>
                            <h3 className="font-semibold text-[#101E57]">{slot.event.name}</h3>
                            <div className="flex items-center gap-3 text-sm text-[#667085]">
                              <span>{slot.event.duration_minutes} min</span>
                              <span>•</span>
                              <span>{confirmedBookings.length} attendee{confirmedBookings.length !== 1 ? 's' : ''}</span>
                              {isWebinar && (
                                <>
                                  <span>•</span>
                                  <span className="text-[#6F71EE]">Webinar</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {slot.google_meet_link && (
                            <a
                              href={slot.google_meet_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-[#6F71EE] text-white text-sm font-medium rounded-lg hover:bg-[#5B5DD6] transition"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                              </svg>
                              Join Meeting
                            </a>
                          )}
                          <Link
                            href={`/admin/events/${slot.event.id}`}
                            className="p-2 text-[#667085] hover:text-[#101E57] hover:bg-[#F6F6F9] rounded-lg transition"
                            title="View event"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </Link>
                        </div>
                      </div>

                      {/* Attendees and what they want to discuss */}
                      <CardBody className="bg-[#FAFAFA]">
                        <div className="space-y-4">
                          {confirmedBookings.map(booking => (
                            <div key={booking.id} className="bg-white rounded-lg p-4 border border-[#E0E0E0]">
                              {/* Attendee info */}
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-9 h-9 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] font-medium text-sm">
                                  {booking.first_name[0]}{booking.last_name[0]}
                                </div>
                                <div>
                                  <div className="font-medium text-[#101E57]">
                                    {booking.first_name} {booking.last_name}
                                  </div>
                                  <div className="text-sm text-[#667085]">{booking.email}</div>
                                </div>
                              </div>

                              {/* Booking question responses */}
                              {booking.question_responses && Object.keys(booking.question_responses).length > 0 && (
                                <div className="space-y-2 pt-3 border-t border-[#E0E0E0]">
                                  {Object.entries(booking.question_responses).map(([questionId, answer]) => (
                                    <div key={questionId}>
                                      <div className="text-xs font-medium text-[#667085] mb-0.5">
                                        {getQuestionLabel(questionId, slot.event.custom_questions)}
                                      </div>
                                      <div className="text-sm text-[#101E57]">{answer}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardBody>

                      {/* Webinar preparation checklist (only for webinars) */}
                      {isWebinar && (
                        <div className="px-5 py-3 bg-[#F6F6F9] border-t border-[#E0E0E0]">
                          <WebinarChecklist event={slot.event} />
                        </div>
                      )}
                    </Card>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

// Simple checklist for webinar preparation
function WebinarChecklist({ event }: { event: Slot['event'] }) {
  const hasDescription = !!event.description && event.description.trim().length > 0;
  const hasQuestions = !!(event.custom_questions && event.custom_questions.length > 0);

  const items = [
    { label: 'Description set', done: hasDescription },
    { label: 'Booking questions ready', done: hasQuestions },
  ];

  const allDone = items.every(i => i.done);

  if (allDone) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#059669]">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Webinar is ready</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-xs font-medium text-[#667085] uppercase">Preparation</span>
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5 text-sm">
          {item.done ? (
            <svg className="w-4 h-4 text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-[#D97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
            </svg>
          )}
          <span className={item.done ? 'text-[#667085]' : 'text-[#101E57]'}>{item.label}</span>
        </div>
      ))}
      <Link
        href={`/admin/events/${event.id}/settings`}
        className="text-sm text-[#6F71EE] hover:underline ml-auto"
      >
        Edit settings
      </Link>
    </div>
  );
}
