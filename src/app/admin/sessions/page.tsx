'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow, parseISO, isWithinInterval, addMinutes } from 'date-fns';

interface Attendee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  attended_at: string | null;
  no_show_at: string | null;
  company: string | null;
  isFirstTime: boolean;
  question_responses: Record<string, string> | null;
}

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
  attendees: Attendee[];
  isPast: boolean;
}

interface SessionsData {
  sessions: Session[];
  hubspotConnected: boolean;
}

function getSessionStatus(session: Session): 'live' | 'upcoming' | 'past' | 'needs-wrapup' {
  const now = new Date();
  const start = parseISO(session.start_time);
  const end = parseISO(session.end_time);

  if (isWithinInterval(now, { start, end: addMinutes(end, 15) })) {
    return 'live';
  }
  if (session.isPast) {
    // Check if wrap-up is needed (has attendees but no attendance marked)
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

function StatCard({
  label,
  value,
  subtext,
  color,
}: {
  label: string;
  value: number | string;
  subtext?: string;
  color?: 'blue' | 'green' | 'red' | 'gray';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color || 'gray']}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium">{label}</div>
      {subtext && <div className="text-xs opacity-75 mt-1">{subtext}</div>}
    </div>
  );
}

function SessionRow({ session, onRefresh }: { session: Session; onRefresh: () => void }) {
  const status = getSessionStatus(session);
  const startTime = parseISO(session.start_time);
  const attendedCount = session.attendees.filter((a) => a.attended_at).length;
  const noShowCount = session.attendees.filter((a) => a.no_show_at).length;
  const unmarkedCount = session.attendees.filter(
    (a) => !a.attended_at && !a.no_show_at
  ).length;

  const statusColors = {
    live: 'bg-green-100 text-green-800 border-green-200',
    upcoming: 'bg-blue-100 text-blue-800 border-blue-200',
    past: 'bg-gray-100 text-gray-600 border-gray-200',
    'needs-wrapup': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };

  const statusLabels = {
    live: 'Live Now',
    upcoming: 'Upcoming',
    past: 'Completed',
    'needs-wrapup': 'Needs Wrap-up',
  };

  return (
    <div
      className={`p-4 rounded-lg border ${
        status === 'live' ? 'border-green-300 bg-green-50/50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Session Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="font-semibold text-[#101E57]">
              {format(startTime, 'h:mm a')}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusColors[status]}`}
            >
              {statusLabels[status]}
            </span>
            {status === 'upcoming' && (
              <span className="text-sm text-[#667085]">
                in {formatDistanceToNow(startTime)}
              </span>
            )}
          </div>
          <div className="font-medium text-[#101E57]">{session.event.name}</div>
          <div className="text-sm text-[#667085] mt-1">
            {session.attendees.length} attendee{session.attendees.length !== 1 ? 's' : ''}
            {session.isPast && session.attendees.length > 0 && (
              <span>
                {' '}
                &middot; {attendedCount} attended &middot; {noShowCount} no-show
                {unmarkedCount > 0 && (
                  <span className="text-yellow-600"> &middot; {unmarkedCount} unmarked</span>
                )}
              </span>
            )}
          </div>

          {/* Attendee Preview */}
          {session.attendees.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {session.attendees.slice(0, 5).map((attendee) => (
                <span
                  key={attendee.id}
                  className={`px-2 py-0.5 text-xs rounded-full ${
                    attendee.attended_at
                      ? 'bg-green-100 text-green-700'
                      : attendee.no_show_at
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {attendee.first_name} {attendee.last_name.charAt(0)}.
                  {attendee.isFirstTime && ' (New)'}
                </span>
              ))}
              {session.attendees.length > 5 && (
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  +{session.attendees.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {status === 'live' && session.google_meet_link && (
            <a
              href={session.google_meet_link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
            >
              Join Meet
            </a>
          )}

          {status === 'upcoming' && session.google_meet_link && (
            <a
              href={session.google_meet_link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#6F71EE] text-white text-sm font-medium rounded-lg hover:bg-[#5a5cd0] transition"
            >
              Join Meet
            </a>
          )}

          <Link
            href={`/admin/events/${session.event.id}#slot-${session.id}`}
            className="px-3 py-1.5 border border-gray-300 text-[#667085] text-sm font-medium rounded-lg hover:bg-gray-50 transition"
          >
            {status === 'needs-wrapup' ? 'Wrap Up' : 'View Details'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SessionDashboardPage() {
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/today-sessions');
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError("Failed to load today's sessions");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    // Auto-refresh every minute
    const interval = setInterval(fetchSessions, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-gray-200 rounded" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg" />
              ))}
            </div>
            <div className="h-32 bg-gray-200 rounded-lg" />
            <div className="h-32 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
        </div>
      </div>
    );
  }

  const sessions = data?.sessions || [];
  const liveSessions = sessions.filter((s) => getSessionStatus(s) === 'live');
  const needsWrapup = sessions.filter((s) => getSessionStatus(s) === 'needs-wrapup');
  const upcomingSessions = sessions.filter((s) => getSessionStatus(s) === 'upcoming');
  const completedSessions = sessions.filter((s) => getSessionStatus(s) === 'past');

  const totalAttendees = sessions.reduce((sum, s) => sum + s.attendees.length, 0);
  const attendedCount = sessions.reduce(
    (sum, s) => sum + s.attendees.filter((a) => a.attended_at).length,
    0
  );
  const noShowCount = sessions.reduce(
    (sum, s) => sum + s.attendees.filter((a) => a.no_show_at).length,
    0
  );
  const firstTimeCount = sessions.reduce(
    (sum, s) => sum + s.attendees.filter((a) => a.isFirstTime).length,
    0
  );

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#101E57]">Session Dashboard</h1>
              <p className="text-sm text-[#667085]">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <Link
              href="/admin"
              className="text-sm text-[#6F71EE] hover:underline"
            >
              Back to Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Sessions Today"
            value={sessions.length}
            color="blue"
          />
          <StatCard
            label="Total Attendees"
            value={totalAttendees}
            subtext={firstTimeCount > 0 ? `${firstTimeCount} first-time` : undefined}
            color="gray"
          />
          <StatCard
            label="Attended"
            value={attendedCount}
            color="green"
          />
          <StatCard
            label="No-shows"
            value={noShowCount}
            color="red"
          />
        </div>

        {/* Live Sessions */}
        {liveSessions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-[#101E57] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live Now
            </h2>
            <div className="space-y-3">
              {liveSessions.map((session) => (
                <SessionRow key={session.id} session={session} onRefresh={fetchSessions} />
              ))}
            </div>
          </div>
        )}

        {/* Needs Wrap-up */}
        {needsWrapup.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-[#101E57] mb-3 flex items-center gap-2">
              <span className="text-yellow-500">!</span>
              Needs Wrap-up
            </h2>
            <div className="space-y-3">
              {needsWrapup.map((session) => (
                <SessionRow key={session.id} session={session} onRefresh={fetchSessions} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Sessions */}
        {upcomingSessions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-[#101E57] mb-3">Upcoming</h2>
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <SessionRow key={session.id} session={session} onRefresh={fetchSessions} />
              ))}
            </div>
          </div>
        )}

        {/* Completed Sessions */}
        {completedSessions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-[#667085] mb-3">Completed</h2>
            <div className="space-y-3">
              {completedSessions.map((session) => (
                <SessionRow key={session.id} session={session} onRefresh={fetchSessions} />
              ))}
            </div>
          </div>
        )}

        {/* No Sessions */}
        {sessions.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-3">📅</div>
            <h3 className="text-lg font-semibold text-[#101E57] mb-2">
              No sessions scheduled for today
            </h3>
            <p className="text-[#667085] mb-4">
              Sessions will appear here when they&apos;re scheduled.
            </p>
            <Link
              href="/admin"
              className="text-[#6F71EE] hover:underline"
            >
              Go to Admin Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
