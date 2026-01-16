'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns';

interface Attendee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  sms_reminder_24h_sent_at: string | null;
  sms_reminder_1h_sent_at: string | null;
  sms_consent: boolean;
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

interface TodaysSessionsData {
  sessions: Session[];
  hubspotConnected: boolean;
}

function ReminderStatusIcon({ sent, label }: { sent: boolean; label: string }) {
  return (
    <span
      title={sent ? `${label} sent` : `${label} not sent`}
      className={`inline-flex items-center justify-center w-5 h-5 text-xs rounded ${
        sent
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-400'
      }`}
    >
      {sent ? '✓' : '–'}
    </span>
  );
}

function AttendeeRow({ attendee, sessionStartTime }: { attendee: Attendee; sessionStartTime: string }) {
  const sessionStart = parseISO(sessionStartTime);
  const now = new Date();
  const hoursUntilSession = (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Determine if 24h reminder should have been sent
  const should24hBeSent = hoursUntilSession < 24;
  // Determine if 1h reminder should have been sent
  const should1hBeSent = hoursUntilSession < 1;

  // Attendance status for past sessions
  const attendanceStatus = attendee.attended_at
    ? 'attended'
    : attendee.no_show_at
    ? 'no-show'
    : null;

  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-full bg-[#EEF0FF] flex items-center justify-center flex-shrink-0">
          <span className="text-sm text-[#6F71EE]">
            {attendee.first_name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#101E57] truncate">
              {attendee.first_name} {attendee.last_name}
            </span>
            {attendee.isFirstTime && (
              <span className="text-xs bg-[#EEF0FF] text-[#6F71EE] px-1.5 py-0.5 rounded">
                New
              </span>
            )}
            {attendanceStatus === 'attended' && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                Attended
              </span>
            )}
            {attendanceStatus === 'no-show' && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                No-show
              </span>
            )}
          </div>
          <div className="text-xs text-[#667085] truncate">
            {attendee.company || attendee.email}
          </div>
        </div>
      </div>

      {/* Reminder status */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
        <ReminderStatusIcon
          sent={!!attendee.reminder_24h_sent_at}
          label="24h email"
        />
        <ReminderStatusIcon
          sent={!!attendee.reminder_1h_sent_at}
          label="1h email"
        />
        {attendee.sms_consent ? (
          <span
            title={attendee.sms_reminder_24h_sent_at ? 'SMS sent' : 'SMS not sent'}
            className={`inline-flex items-center justify-center w-5 h-5 text-xs rounded ${
              attendee.sms_reminder_24h_sent_at
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {attendee.sms_reminder_24h_sent_at ? '📱' : '–'}
          </span>
        ) : (
          <span className="w-5 h-5" /> // Placeholder for alignment
        )}
      </div>
    </div>
  );
}

function SessionCard({ session, isNextSession }: { session: Session; isNextSession: boolean }) {
  const [expanded, setExpanded] = useState(isNextSession);
  const startTime = parseISO(session.start_time);
  const endTime = parseISO(session.end_time);
  const now = new Date();

  const timeUntil = !session.isPast
    ? formatDistanceToNow(startTime, { addSuffix: false })
    : null;

  const attendeeCount = session.attendees.length;
  const attendedCount = session.attendees.filter((a) => a.attended_at).length;
  const noShowCount = session.attendees.filter((a) => a.no_show_at).length;

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        session.isPast ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
      }`}
    >
      {/* Session Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="text-left">
            <div className={`font-semibold ${session.isPast ? 'text-gray-500' : 'text-[#101E57]'}`}>
              {format(startTime, 'h:mm a')}
            </div>
            {timeUntil && !session.isPast && (
              <div className="text-xs text-[#667085]">in {timeUntil}</div>
            )}
            {session.isPast && (
              <div className="text-xs text-gray-500">Completed</div>
            )}
          </div>
          <div className="text-left">
            <div className={`font-medium ${session.isPast ? 'text-gray-500' : 'text-[#101E57]'}`}>
              {session.event.name}
            </div>
            <div className="text-xs text-[#667085]">
              {attendeeCount} {attendeeCount === 1 ? 'attendee' : 'attendees'}
              {session.isPast && attendeeCount > 0 && (
                <span className="ml-2">
                  ({attendedCount} attended, {noShowCount} no-show)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {session.google_meet_link && !session.isPast && (
            <a
              href={session.google_meet_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-1.5 text-sm bg-[#6F71EE] text-white rounded-lg hover:bg-[#5B5DD6] transition-colors"
            >
              Join Meet
            </a>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Attendee List */}
      {expanded && (
        <div className="border-t border-gray-100">
          {session.attendees.length === 0 ? (
            <div className="px-4 py-6 text-center text-[#667085]">
              No attendees booked yet
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {session.attendees.map((attendee) => (
                <AttendeeRow
                  key={attendee.id}
                  attendee={attendee}
                  sessionStartTime={session.start_time}
                />
              ))}
            </div>
          )}

          {/* Legend */}
          {session.attendees.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center gap-4 text-xs text-[#667085]">
                <span>Reminders:</span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 bg-green-100 text-green-700 rounded text-center text-[10px] leading-4">✓</span>
                  24h
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 bg-green-100 text-green-700 rounded text-center text-[10px] leading-4">✓</span>
                  1h
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 bg-blue-100 text-blue-700 rounded text-center text-[10px] leading-4">📱</span>
                  SMS
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TodaysSessions() {
  const [data, setData] = useState<TodaysSessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/today-sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Failed to load today\'s sessions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <div className="h-6 w-40 bg-gray-200 animate-pulse rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-100 animate-pulse rounded-lg" />
          <div className="h-20 bg-gray-100 animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const sessions = data?.sessions || [];
  const upcomingSessions = sessions.filter((s) => !s.isPast);
  const pastSessions = sessions.filter((s) => s.isPast);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[#101E57]">
          Today&apos;s Sessions
        </h2>
        {!data?.hubspotConnected && sessions.some((s) => s.attendees.length > 0) && (
          <Link
            href="/admin/integrations"
            className="text-xs text-[#6F71EE] hover:underline"
          >
            Connect HubSpot for company data
          </Link>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">📅</div>
          <p className="text-[#667085]">No sessions scheduled for today</p>
          <Link
            href="/admin"
            className="text-sm text-[#6F71EE] hover:underline mt-2 inline-block"
          >
            View all events
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Upcoming Sessions */}
          {upcomingSessions.map((session, index) => (
            <SessionCard
              key={session.id}
              session={session}
              isNextSession={index === 0}
            />
          ))}

          {/* Past Sessions (collapsed section) */}
          {pastSessions.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-medium text-[#667085] uppercase tracking-wide mb-2">
                Earlier Today
              </div>
              {pastSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isNextSession={false}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
