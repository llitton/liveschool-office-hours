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

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <AdminHeader email="" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#101E57] mb-2">Past Sessions</h1>
          <p className="text-[#667085]">
            Review completed sessions and attendance
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#101E57] mb-2">No past sessions yet</h3>
            <p className="text-[#667085] mb-6 max-w-md mx-auto">
              Once you run your first session, it will appear here.
            </p>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-[#6F71EE] font-medium hover:underline"
            >
              View today's sessions
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
              const totalAttended = daySessions.reduce((sum, s) => sum + s.attendedCount, 0);
              const totalBooked = daySessions.reduce((sum, s) => sum + s.attendeeCount, 0);

              return (
                <div key={dateKey} className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
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
                                    <div className="text-sm font-medium text-green-600">
                                      {session.attendedCount}
                                    </div>
                                    <div className="text-xs text-[#667085]">attended</div>
                                  </div>
                                  {session.noShowCount > 0 && (
                                    <div className="text-center">
                                      <div className="text-sm font-medium text-red-600">
                                        {session.noShowCount}
                                      </div>
                                      <div className="text-xs text-[#667085]">no-show</div>
                                    </div>
                                  )}
                                </div>
                                {attendanceRate !== null && (
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    attendanceRate >= 80 ? 'bg-green-50 text-green-700' :
                                    attendanceRate >= 50 ? 'bg-amber-50 text-amber-700' :
                                    'bg-red-50 text-red-700'
                                  }`}>
                                    {attendanceRate}%
                                  </span>
                                )}
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
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
