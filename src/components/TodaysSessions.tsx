'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

interface Attendee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
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
    slug: string;
    max_attendees: number;
  };
  attendees: Attendee[];
  isPast: boolean;
}

interface TodaysSessionsData {
  sessions: Session[];
  hubspotConnected: boolean;
}

// Compact row for empty or completed sessions
function CompactSessionRow({ session }: { session: Session }) {
  const startTime = parseISO(session.start_time);
  const attendeeCount = session.attendees.length;

  return (
    <Link
      href={`/admin/events/${session.event.id}`}
      className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg transition group"
    >
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${session.isPast ? 'text-[#667085]' : 'text-[#101E57]'}`}>
          {format(startTime, 'h:mm a')}
        </span>
        <span className={`text-sm ${session.isPast ? 'text-[#667085]' : 'text-[#101E57]'}`}>
          {session.event.name}
        </span>
        <span className="text-sm text-[#667085]">
          {attendeeCount === 0 ? 'No attendees' : `${attendeeCount} attendee${attendeeCount !== 1 ? 's' : ''}`}
        </span>
      </div>
      <svg className="w-4 h-4 text-[#667085] group-hover:text-[#6F71EE] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// Expanded card for upcoming sessions with attendees
function ExpandedSessionCard({ session }: { session: Session }) {
  const startTime = parseISO(session.start_time);
  const timeUntil = formatDistanceToNow(startTime, { addSuffix: false });
  const attendeeCount = session.attendees.length;

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="font-semibold text-[#101E57]">{format(startTime, 'h:mm a')}</div>
            <div className="text-xs text-[#667085]">in {timeUntil}</div>
          </div>
          <div>
            <div className="font-medium text-[#101E57]">{session.event.name}</div>
            <div className="text-xs text-[#667085]">{attendeeCount} attendee{attendeeCount !== 1 ? 's' : ''}</div>
          </div>
        </div>
        {session.google_meet_link && (
          <a
            href={session.google_meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm bg-[#6F71EE] text-white rounded-lg hover:bg-[#5B5DD6] transition"
          >
            Join Meet
          </a>
        )}
      </div>

      {/* Attendee list */}
      <div className="border-t border-gray-100 divide-y divide-gray-50">
        {session.attendees.map((attendee) => (
          <div key={attendee.id} className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#EEF0FF] flex items-center justify-center">
                <span className="text-sm text-[#6F71EE]">{attendee.first_name.charAt(0)}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#101E57] text-sm">
                    {attendee.first_name} {attendee.last_name}
                  </span>
                  {attendee.isFirstTime && (
                    <span className="text-xs bg-[#EEF0FF] text-[#6F71EE] px-1.5 py-0.5 rounded">New</span>
                  )}
                </div>
                <div className="text-xs text-[#667085]">{attendee.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className={`w-5 h-5 rounded text-xs flex items-center justify-center ${
                attendee.reminder_24h_sent_at ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              }`}>
                {attendee.reminder_24h_sent_at ? '24h' : '-'}
              </span>
              <span className={`w-5 h-5 rounded text-xs flex items-center justify-center ${
                attendee.reminder_1h_sent_at ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              }`}>
                {attendee.reminder_1h_sent_at ? '1h' : '-'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TodaysSessions() {
  const [data, setData] = useState<TodaysSessionsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="animate-pulse h-20 bg-gray-100 rounded" />
      </div>
    );
  }

  const sessions = data?.sessions || [];
  if (sessions.length === 0) {
    return null; // Don't show empty section - reduces noise
  }

  const upcomingSessions = sessions.filter((s) => !s.isPast);
  const pastSessions = sessions.filter((s) => s.isPast);

  // Sessions with attendees get expanded view, empty sessions get compact view
  const upcomingWithAttendees = upcomingSessions.filter((s) => s.attendees.length > 0);
  const upcomingEmpty = upcomingSessions.filter((s) => s.attendees.length === 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
      <h2 className="text-base font-semibold text-[#101E57] mb-3">Today</h2>

      <div className="space-y-2">
        {/* Upcoming sessions with attendees - expanded */}
        {upcomingWithAttendees.map((session) => (
          <ExpandedSessionCard key={session.id} session={session} />
        ))}

        {/* Upcoming empty sessions - compact */}
        {upcomingEmpty.length > 0 && (
          <div className="text-xs text-[#667085] uppercase tracking-wide pt-2">
            {upcomingWithAttendees.length > 0 ? 'Also upcoming' : 'Upcoming'}
          </div>
        )}
        {upcomingEmpty.map((session) => (
          <CompactSessionRow key={session.id} session={session} />
        ))}

        {/* Past sessions - always compact */}
        {pastSessions.length > 0 && (
          <>
            <div className="text-xs text-[#667085] uppercase tracking-wide pt-2">Earlier</div>
            {pastSessions.map((session) => (
              <CompactSessionRow key={session.id} session={session} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
