'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow, parseISO, isWithinInterval, addMinutes } from 'date-fns';

interface Attendee {
  id: string;
  first_name: string;
  last_name: string;
  attended_at: string | null;
  no_show_at: string | null;
  isFirstTime: boolean;
}

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  google_meet_link: string | null;
  event: {
    id: string;
    name: string;
    max_attendees: number;
  };
  attendees: Attendee[];
  isPast: boolean;
}

interface SessionsData {
  sessions: Session[];
}

function getSessionStatus(session: Session): 'live' | 'upcoming' | 'past' | 'needs-wrapup' {
  const now = new Date();
  const start = parseISO(session.start_time);
  const end = parseISO(session.end_time);

  if (isWithinInterval(now, { start, end: addMinutes(end, 15) })) {
    return 'live';
  }
  if (session.isPast) {
    const hasUnmarkedAttendees = session.attendees.some(
      (a) => !a.attended_at && !a.no_show_at
    );
    if (hasUnmarkedAttendees && session.attendees.length > 0) {
      return 'needs-wrapup';
    }
    return 'past';
  }
  return 'upcoming';
}

// Compact row for sessions
function SessionRow({ session }: { session: Session }) {
  const status = getSessionStatus(session);
  const startTime = parseISO(session.start_time);
  const attendeeCount = session.attendees.length;
  const hasAttendees = attendeeCount > 0;

  return (
    <div className={`flex items-center justify-between py-3 px-4 rounded-lg ${
      status === 'live' ? 'bg-green-50 border border-green-200' :
      status === 'needs-wrapup' ? 'bg-yellow-50 border border-yellow-200' :
      'bg-white border border-gray-200'
    }`}>
      <div className="flex items-center gap-4">
        <div className="text-left min-w-[70px]">
          <div className={`font-semibold ${status === 'live' ? 'text-green-700' : 'text-[#101E57]'}`}>
            {format(startTime, 'h:mm a')}
          </div>
          {status === 'upcoming' && (
            <div className="text-xs text-[#667085]">in {formatDistanceToNow(startTime)}</div>
          )}
          {status === 'live' && (
            <div className="text-xs text-green-600 font-medium">Live</div>
          )}
        </div>
        <div>
          <div className="font-medium text-[#101E57]">{session.event.name}</div>
          <div className="text-sm text-[#667085]">
            {attendeeCount === 0 ? 'No attendees' : `${attendeeCount} attendee${attendeeCount !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {status === 'live' && session.google_meet_link && (
          <a
            href={session.google_meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
          >
            Join
          </a>
        )}
        {status === 'upcoming' && hasAttendees && session.google_meet_link && (
          <a
            href={session.google_meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-[#6F71EE] text-white text-sm font-medium rounded-lg hover:bg-[#5a5cd0] transition"
          >
            Join
          </a>
        )}
        {status === 'needs-wrapup' && (
          <Link
            href={`/admin/events/${session.event.id}#slot-${session.id}`}
            className="px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition"
          >
            Wrap Up
          </Link>
        )}
        <Link
          href={`/admin/events/${session.event.id}`}
          className="text-[#667085] hover:text-[#6F71EE] transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

export default function SessionDashboardPage() {
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/today-sessions');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-32 bg-gray-200 rounded" />
            <div className="h-16 bg-gray-200 rounded-lg" />
            <div className="h-16 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const sessions = data?.sessions || [];
  const liveSessions = sessions.filter((s) => getSessionStatus(s) === 'live');
  const needsWrapup = sessions.filter((s) => getSessionStatus(s) === 'needs-wrapup');
  const upcomingSessions = sessions.filter((s) => getSessionStatus(s) === 'upcoming');
  const completedSessions = sessions.filter((s) => getSessionStatus(s) === 'past');

  // Actionable metrics
  const totalBooked = sessions.reduce((sum, s) => sum + s.attendees.length, 0);
  const totalCapacity = sessions.reduce((sum, s) => sum + s.event.max_attendees, 0);
  const capacityUsed = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

  // Only show attendance stats if there are completed sessions
  const hasCompletedSessions = completedSessions.length > 0 || needsWrapup.length > 0;
  const attendedCount = sessions.reduce(
    (sum, s) => sum + s.attendees.filter((a) => a.attended_at).length, 0
  );

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[#101E57]">
                {format(new Date(), 'EEEE, MMM d')}
              </h1>
              <p className="text-sm text-[#667085]">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                {totalBooked > 0 && ` · ${totalBooked} booked · ${capacityUsed}% capacity`}
              </p>
            </div>
            <Link href="/admin" className="text-sm text-[#6F71EE] hover:underline">
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {/* Live - always show first with prominence */}
        {liveSessions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-700">Live Now</span>
            </div>
            <div className="space-y-2">
              {liveSessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {/* Needs Wrap-up - action required */}
        {needsWrapup.length > 0 && (
          <div>
            <div className="text-sm font-medium text-yellow-700 mb-2">
              {needsWrapup.length} session{needsWrapup.length !== 1 ? 's' : ''} need wrap-up
            </div>
            <div className="space-y-2">
              {needsWrapup.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcomingSessions.length > 0 && (
          <div>
            <div className="text-sm font-medium text-[#667085] mb-2">Upcoming</div>
            <div className="space-y-2">
              {upcomingSessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {/* Completed - collapsed summary */}
        {completedSessions.length > 0 && (
          <div>
            <div className="text-sm font-medium text-[#667085] mb-2">
              Done ({attendedCount} attended)
            </div>
            <div className="space-y-2">
              {completedSessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#667085] mb-2">No sessions today</p>
            <Link href="/admin" className="text-[#6F71EE] hover:underline text-sm">
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
