'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import AppShell, { PageContainer, PageHeader } from '@/components/AppShell';
import { Card, CardBody, EmptyState } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  google_meet_link: string | null;
  event: {
    id: string;
    name: string;
    slug: string;
    max_attendees: number;
  };
  attendeeCount: number;
}

export default function UpcomingPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/sessions?period=upcoming&limit=100');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group sessions by date
  const groupedSessions = sessions.reduce((acc, session) => {
    const dateKey = format(parseISO(session.start_time), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(session);
    return acc;
  }, {} as Record<string, Session[]>);

  const sortedDates = Object.keys(groupedSessions).sort();

  if (loading) {
    return (
      <AppShell>
        <PageContainer narrow>
          <PageHeader
            title="Upcoming Sessions"
            description="Sessions scheduled for the future"
          />
          <Card>
            <CardBody>
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-32" />
                <div className="h-16 bg-gray-100 rounded" />
                <div className="h-16 bg-gray-100 rounded" />
              </div>
            </CardBody>
          </Card>
        </PageContainer>
      </AppShell>
    );
  }

  if (sessions.length === 0) {
    return (
      <AppShell>
        <PageContainer narrow>
          <PageHeader
            title="Upcoming Sessions"
            description="Sessions scheduled for the future"
          />
          <EmptyState
            icon={
              <svg className="w-7 h-7 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            title="No upcoming sessions"
            description="Create time slots on your events to see upcoming sessions here."
            action={
              <LinkButton href="/admin" variant="tertiary">
                View your events
              </LinkButton>
            }
          />
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer narrow>
        <PageHeader
          title="Upcoming Sessions"
          description="Sessions scheduled for the future"
        />

        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const date = parseISO(dateKey);
            const daySessions = groupedSessions[dateKey];

            return (
              <Card key={dateKey}>
                <div className="px-5 py-3 bg-[#FAFAFA] border-b border-[#E0E0E0]">
                  <h2 className="font-semibold text-[#101E57]">
                    {format(date, 'EEEE, MMMM d, yyyy')}
                  </h2>
                  <p className="text-sm text-[#667085]">
                    {formatDistanceToNow(date, { addSuffix: true })} · {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="divide-y divide-[#E0E0E0]">
                  {daySessions.map((session) => {
                    const startTime = parseISO(session.start_time);
                    const endTime = parseISO(session.end_time);
                    const capacityPercent = session.event.max_attendees > 0
                      ? Math.round((session.attendeeCount / session.event.max_attendees) * 100)
                      : 0;

                    return (
                      <Link
                        key={session.id}
                        href={`/admin/events/${session.event.id}`}
                        className="flex items-center justify-between px-5 py-4 hover:bg-[#FAFAFA] transition group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[60px]">
                            <div className="font-semibold text-[#101E57]">
                              {format(startTime, 'h:mm')}
                            </div>
                            <div className="text-xs text-[#667085]">
                              {format(startTime, 'a')}
                            </div>
                          </div>
                          <div className="h-10 w-px bg-[#E0E0E0]" />
                          <div>
                            <div className="font-medium text-[#101E57] group-hover:text-[#6F71EE] transition">
                              {session.event.name}
                            </div>
                            <div className="text-sm text-[#667085]">
                              {format(startTime, 'h:mm a')} – {format(endTime, 'h:mm a')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium text-[#101E57]">
                              {session.attendeeCount} / {session.event.max_attendees}
                            </div>
                            <div className="text-xs text-[#667085]">
                              {capacityPercent}% booked
                            </div>
                          </div>

                          {session.google_meet_link && (
                            <a
                              href={session.google_meet_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1.5 text-sm bg-[#6F71EE] text-white rounded-lg hover:bg-[#5B5DD6] transition"
                            >
                              Join
                            </a>
                          )}

                          <svg className="w-5 h-5 text-[#667085] group-hover:text-[#6F71EE] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </PageContainer>
    </AppShell>
  );
}
