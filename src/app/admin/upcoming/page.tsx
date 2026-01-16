'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import AdminHeader from '@/components/AdminHeader';

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

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <AdminHeader email="" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#101E57] mb-2">Upcoming Sessions</h1>
          <p className="text-[#667085]">
            Sessions scheduled for the future
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-32" />
              <div className="h-16 bg-gray-100 rounded" />
              <div className="h-16 bg-gray-100 rounded" />
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E0E0E0] p-12 text-center">
            <div className="w-14 h-14 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#101E57] mb-2">No upcoming sessions</h3>
            <p className="text-[#667085] mb-6 max-w-md mx-auto">
              Create time slots on your events to see upcoming sessions here.
            </p>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-[#6F71EE] font-medium hover:underline"
            >
              View your events
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((dateKey) => {
              const date = parseISO(dateKey);
              const daySessions = groupedSessions[dateKey];

              return (
                <div key={dateKey} className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
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
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
