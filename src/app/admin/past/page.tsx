'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { PageContainer, PageHeader } from '@/components/AppShell';
import { Card, CardBody, EmptyState } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';
import { AttendanceBadge } from '@/components/ui/Badge';

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
  attendedCount: number;
  noShowCount: number;
}

export default function PastPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/sessions?period=past&limit=100');
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

  // Group sessions by date (most recent first)
  const groupedSessions = sessions.reduce((acc, session) => {
    const dateKey = format(parseISO(session.start_time), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(session);
    return acc;
  }, {} as Record<string, Session[]>);

  const sortedDates = Object.keys(groupedSessions).sort().reverse();

  if (loading) {
    return (
      <>
        <PageContainer narrow>
          <PageHeader
            title="Past Sessions"
            description="Review completed sessions and attendance"
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
      </>
    );
  }

  if (sessions.length === 0) {
    return (
      <>
        <PageContainer narrow>
          <PageHeader
            title="Past Sessions"
            description="Review completed sessions and attendance"
          />
          <EmptyState
            icon={
              <svg className="w-7 h-7 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="No past sessions yet"
            description="Once you run your first session, it will appear here."
            action={
              <LinkButton href="/admin" variant="tertiary">
                View today's sessions
              </LinkButton>
            }
          />
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <PageContainer narrow>
        <PageHeader
          title="Past Sessions"
          description="Review completed sessions and attendance"
        />

        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const date = parseISO(dateKey);
            const daySessions = groupedSessions[dateKey];
            const totalAttended = daySessions.reduce((sum, s) => sum + s.attendedCount, 0);
            const totalBooked = daySessions.reduce((sum, s) => sum + s.attendeeCount, 0);

            return (
              <Card key={dateKey}>
                <div className="px-5 py-3 bg-[#FAFAFA] border-b border-[#E0E0E0] flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-[#101E57]">
                      {format(date, 'EEEE, MMMM d, yyyy')}
                    </h2>
                    <p className="text-sm text-[#667085]">
                      {formatDistanceToNow(date, { addSuffix: true })} · {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {totalBooked > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-medium text-[#101E57]">
                        {totalAttended} / {totalBooked} attended
                      </div>
                      <div className="text-xs text-[#667085]">
                        {Math.round((totalAttended / totalBooked) * 100)}% attendance
                      </div>
                    </div>
                  )}
                </div>

                <div className="divide-y divide-[#E0E0E0]">
                  {daySessions.map((session) => {
                    const startTime = parseISO(session.start_time);
                    const endTime = parseISO(session.end_time);
                    const attendanceRate = session.attendeeCount > 0
                      ? Math.round((session.attendedCount / session.attendeeCount) * 100)
                      : null;

                    return (
                      <Link
                        key={session.id}
                        href={`/admin/events/${session.event.id}`}
                        className="flex items-center justify-between px-5 py-4 hover:bg-[#FAFAFA] transition group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[60px]">
                            <div className="font-semibold text-[#667085]">
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

                        <div className="flex items-center gap-6">
                          {session.attendeeCount > 0 ? (
                            <>
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <div className="text-sm font-medium text-[#059669]">
                                    {session.attendedCount}
                                  </div>
                                  <div className="text-xs text-[#667085]">attended</div>
                                </div>
                                {session.noShowCount > 0 && (
                                  <div className="text-center">
                                    <div className="text-sm font-medium text-[#DC2626]">
                                      {session.noShowCount}
                                    </div>
                                    <div className="text-xs text-[#667085]">no-show</div>
                                  </div>
                                )}
                              </div>
                              <AttendanceBadge rate={attendanceRate} />
                            </>
                          ) : (
                            <span className="text-sm text-[#667085]">No attendees</span>
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
    </>
  );
}
