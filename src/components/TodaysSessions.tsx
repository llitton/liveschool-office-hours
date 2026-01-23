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

// Attendee row component (shared between inline list and modal)
function AttendeeRow({ attendee }: { attendee: Attendee }) {
  return (
    <div className="px-4 py-2 flex items-center justify-between">
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
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          attendee.reminder_24h_sent_at ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
        }`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          24h
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          attendee.reminder_1h_sent_at ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
        }`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          1h
        </span>
      </div>
    </div>
  );
}

// Modal for viewing all attendees
function AttendeeListModal({
  attendees,
  sessionName,
  onClose,
}: {
  attendees: Attendee[];
  sessionName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-[#101E57]">Attendees</h3>
            <p className="text-xs text-[#667085]">{sessionName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Attendee list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {attendees.map((attendee) => (
            <AttendeeRow key={attendee.id} attendee={attendee} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Expanded card for upcoming sessions with attendees
const VISIBLE_ATTENDEES = 3;

function ExpandedSessionCard({ session }: { session: Session }) {
  const [showAllModal, setShowAllModal] = useState(false);
  const startTime = parseISO(session.start_time);
  const timeUntil = formatDistanceToNow(startTime, { addSuffix: false });
  const attendeeCount = session.attendees.length;

  const visibleAttendees = session.attendees.slice(0, VISIBLE_ATTENDEES);
  const hiddenCount = attendeeCount - VISIBLE_ATTENDEES;

  return (
    <>
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
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#6F71EE] text-white rounded-lg hover:bg-[#5B5DD6] transition shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Join Meet
            </a>
          )}
        </div>

        {/* Attendee list - first 3 visible */}
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {visibleAttendees.map((attendee) => (
            <AttendeeRow key={attendee.id} attendee={attendee} />
          ))}

          {/* View All button */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAllModal(true)}
              className="w-full py-2.5 text-center text-sm font-medium text-[#6F71EE] hover:bg-[#EEF0FF] transition"
            >
              View All ({attendeeCount})
            </button>
          )}
        </div>
      </div>

      {/* Modal */}
      {showAllModal && (
        <AttendeeListModal
          attendees={session.attendees}
          sessionName={session.event.name}
          onClose={() => setShowAllModal(false)}
        />
      )}
    </>
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
