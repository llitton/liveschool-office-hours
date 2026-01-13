'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface NextSession {
  id: string;
  start_time: string;
  event_id: string;
  event_name: string;
  booked: number;
  capacity: number;
}

interface ActionItem {
  type: 'no_slots' | 'low_bookings' | 'missing_template' | 'upcoming_soon' | 'no_availability' | 'no_calendar';
  title: string;
  impact: string;
  cta: string;
  link: string;
  priority: 'high' | 'medium' | 'low';
}

interface SetupItem {
  id: string;
  label: string;
  completed: boolean;
  link: string;
}

interface Stats {
  nextSession: NextSession | null;
  openCapacity: number;
  upcomingSessions: number;
  attendanceRate: number;
  attendanceContext: string;
  actionItems: ActionItem[];
  setupItems: SetupItem[];
  setupComplete: number;
  setupTotal: number;
  popularTimeSlots: Array<{
    time: string;
    sessions: number;
    totalBookings: number;
    avgBookings: number;
  }>;
  recentBookings: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    created_at: string;
    slot: {
      start_time: string;
      event: { name: string };
    };
  }>;
}

export default function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="animate-pulse text-[#667085]">Loading...</div>
      </div>
    );
  }

  if (!stats) return null;

  const hasActionItems = stats.actionItems && stats.actionItems.length > 0;
  const showSetupChecklist = stats.setupComplete < stats.setupTotal;

  return (
    <div className="space-y-6 mb-8">
      {/* Setup Checklist - Show if not complete */}
      {showSetupChecklist && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#101E57]">Get Started</h2>
              <p className="text-sm text-[#667085]">Complete these steps to start accepting bookings</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-[#6F71EE]">{stats.setupComplete}</span>
              <span className="text-lg text-[#667085]"> / {stats.setupTotal}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-[#F6F6F9] rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-[#6F71EE] rounded-full transition-all"
              style={{ width: `${(stats.setupComplete / stats.setupTotal) * 100}%` }}
            />
          </div>

          <div className="space-y-2">
            {stats.setupItems.map((item) => (
              <Link
                key={item.id}
                href={item.link}
                className={`flex items-center gap-3 p-3 rounded-lg transition ${
                  item.completed
                    ? 'bg-[#417762]/5'
                    : 'bg-[#F6F6F9] hover:bg-[#6F71EE]/5'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.completed
                    ? 'bg-[#417762] text-white'
                    : 'border-2 border-gray-300'
                }`}>
                  {item.completed && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`flex-1 text-sm ${
                  item.completed ? 'text-[#667085] line-through' : 'text-[#101E57] font-medium'
                }`}>
                  {item.label}
                </span>
                {!item.completed && (
                  <span className="text-[#6F71EE] text-sm font-medium">Start →</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Action Items - Redesigned with impact framing */}
        {hasActionItems && (
          <div className="mb-6 pb-6 border-b border-gray-100">
            <h2 className="text-sm font-medium text-[#667085] uppercase tracking-wide mb-3">
              Needs Your Attention
            </h2>
            <div className="space-y-3">
              {stats.actionItems.map((item, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg border-l-4 ${
                    item.priority === 'high'
                      ? 'bg-red-50 border-red-500'
                      : item.priority === 'medium'
                      ? 'bg-amber-50 border-amber-500'
                      : 'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className={`font-medium ${
                        item.priority === 'high'
                          ? 'text-red-800'
                          : item.priority === 'medium'
                          ? 'text-amber-800'
                          : 'text-blue-800'
                      }`}>
                        {item.title}
                      </p>
                      <p className={`text-sm mt-1 ${
                        item.priority === 'high'
                          ? 'text-red-600'
                          : item.priority === 'medium'
                          ? 'text-amber-600'
                          : 'text-blue-600'
                      }`}>
                        {item.impact}
                      </p>
                    </div>
                    <Link
                      href={item.link}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                        item.priority === 'high'
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : item.priority === 'medium'
                          ? 'bg-amber-600 text-white hover:bg-amber-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {item.cta}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Primary Metrics - With guidance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Next Session */}
          <div className="bg-[#F6F6F9] rounded-lg p-4">
            <p className="text-xs font-medium text-[#667085] uppercase tracking-wide mb-1">
              Next Session
            </p>
            {stats.nextSession ? (
              <Link href={`/admin/events/${stats.nextSession.event_id}`} className="block group">
                <p className="text-lg font-semibold text-[#101E57] group-hover:text-[#6F71EE] transition">
                  {format(parseISO(stats.nextSession.start_time), 'EEE, MMM d')} @ {format(parseISO(stats.nextSession.start_time), 'h:mm a')}
                </p>
                <p className="text-sm text-[#667085]">
                  {stats.nextSession.booked} booked · {formatDistanceToNow(parseISO(stats.nextSession.start_time), { addSuffix: true })}
                </p>
                {stats.nextSession.booked === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No bookings yet — share your booking link
                  </p>
                )}
              </Link>
            ) : (
              <div>
                <p className="text-lg font-semibold text-[#667085]">No upcoming sessions</p>
                <Link href="/admin/events/new" className="text-sm text-[#6F71EE] hover:underline">
                  Create time slots to get started →
                </Link>
              </div>
            )}
          </div>

          {/* Open Capacity */}
          <div className="bg-[#F6F6F9] rounded-lg p-4">
            <p className="text-xs font-medium text-[#667085] uppercase tracking-wide mb-1">
              Open Capacity
            </p>
            <p className="text-lg font-semibold text-[#101E57]">
              {stats.openCapacity} <span className="text-base font-normal text-[#667085]">seats</span>
            </p>
            <p className="text-sm text-[#667085]">
              Across {stats.upcomingSessions} session{stats.upcomingSessions !== 1 ? 's' : ''}
            </p>
            {stats.openCapacity === 0 && stats.upcomingSessions > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Fully booked! Consider adding more slots.
              </p>
            )}
            {stats.upcomingSessions === 0 && (
              <p className="text-xs text-[#667085] mt-1">
                Add time slots to open availability
              </p>
            )}
          </div>

          {/* Attendance Health */}
          <div className="bg-[#F6F6F9] rounded-lg p-4">
            <p className="text-xs font-medium text-[#667085] uppercase tracking-wide mb-1">
              Attendance Health
            </p>
            {stats.attendanceRate > 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <p className={`text-lg font-semibold ${
                    stats.attendanceRate >= 80 ? 'text-[#417762]' :
                    stats.attendanceRate >= 60 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {stats.attendanceRate}%
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    stats.attendanceRate >= 80 ? 'bg-[#417762]/10 text-[#417762]' :
                    stats.attendanceRate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {stats.attendanceRate >= 80 ? 'Healthy' : stats.attendanceRate >= 60 ? 'Needs work' : 'Low'}
                  </span>
                </div>
                <p className="text-sm text-[#667085]">{stats.attendanceContext}</p>
                {stats.attendanceRate < 80 && (
                  <p className="text-xs text-[#667085] mt-1">
                    Tip: Send reminders to improve attendance
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-[#667085]">No data yet</p>
                <p className="text-sm text-[#667085]">{stats.attendanceContext || 'Complete sessions to track'}</p>
                <Link href="/admin/analytics" className="text-xs text-[#6F71EE] hover:underline mt-1 inline-block">
                  Learn how tracking works →
                </Link>
              </>
            )}
          </div>
        </div>

      {/* Expand for more details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-[#6F71EE] hover:text-[#5a5cd0] font-medium"
      >
        {expanded ? 'Hide details' : 'View booking analytics'}
      </button>

      {expanded && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          {/* Popular Time Slots */}
          {stats.popularTimeSlots && stats.popularTimeSlots.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[#101E57] mb-3">Most Popular Time Slots</h3>
              <div className="space-y-2">
                {stats.popularTimeSlots.map((slot, i) => (
                  <div
                    key={slot.time}
                    className="flex items-center justify-between bg-[#F6F6F9] rounded-lg px-4 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-[#6F71EE]">#{i + 1}</span>
                      <span className="text-sm text-[#101E57]">{slot.time}</span>
                    </div>
                    <div className="text-sm text-[#667085]">
                      {slot.totalBookings} bookings · avg {slot.avgBookings}/session
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Bookings */}
          {stats.recentBookings && stats.recentBookings.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[#101E57] mb-3">Recent Bookings</h3>
              <div className="space-y-2">
                {stats.recentBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between bg-[#F6F6F9] rounded-lg px-4 py-2"
                  >
                    <div>
                      <span className="text-sm text-[#101E57] font-medium">
                        {booking.first_name} {booking.last_name}
                      </span>
                      <span className="text-sm text-[#667085] ml-2">{booking.email}</span>
                    </div>
                    <div className="text-sm text-[#667085]">
                      {booking.slot?.event?.name} ·{' '}
                      {booking.slot?.start_time && format(parseISO(booking.slot.start_time), 'MMM d')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
