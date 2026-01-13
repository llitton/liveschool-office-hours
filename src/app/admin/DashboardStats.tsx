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
  type: 'no_slots' | 'low_bookings' | 'missing_template' | 'upcoming_soon';
  message: string;
  link: string;
  priority: 'high' | 'medium' | 'low';
}

interface Stats {
  nextSession: NextSession | null;
  openCapacity: number;
  upcomingSessions: number;
  attendanceRate: number;
  attendanceContext: string;
  actionItems: ActionItem[];
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      {/* Action Items - What needs attention */}
      {hasActionItems && (
        <div className="mb-6 pb-6 border-b border-gray-100">
          <h2 className="text-sm font-medium text-[#667085] uppercase tracking-wide mb-3">
            Needs Attention
          </h2>
          <div className="space-y-2">
            {stats.actionItems.map((item, i) => (
              <Link
                key={i}
                href={item.link}
                className={`flex items-center justify-between p-3 rounded-lg transition hover:opacity-80 ${
                  item.priority === 'high'
                    ? 'bg-red-50 border border-red-100'
                    : item.priority === 'medium'
                    ? 'bg-amber-50 border border-amber-100'
                    : 'bg-blue-50 border border-blue-100'
                }`}
              >
                <span className={`text-sm font-medium ${
                  item.priority === 'high'
                    ? 'text-red-700'
                    : item.priority === 'medium'
                    ? 'text-amber-700'
                    : 'text-blue-700'
                }`}>
                  {item.message}
                </span>
                <span className="text-sm opacity-60">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Primary Metrics - Actionable */}
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
            </Link>
          ) : (
            <div>
              <p className="text-lg font-semibold text-[#667085]">No upcoming sessions</p>
              <p className="text-sm text-[#667085]">Create time slots to get started</p>
            </div>
          )}
        </div>

        {/* Open Capacity */}
        <div className="bg-[#F6F6F9] rounded-lg p-4">
          <p className="text-xs font-medium text-[#667085] uppercase tracking-wide mb-1">
            Open Capacity
          </p>
          <p className="text-lg font-semibold text-[#101E57]">
            {stats.openCapacity} <span className="text-base font-normal text-[#667085]">seats available</span>
          </p>
          <p className="text-sm text-[#667085]">
            Across {stats.upcomingSessions} upcoming session{stats.upcomingSessions !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Attendance Health */}
        <div className="bg-[#F6F6F9] rounded-lg p-4">
          <p className="text-xs font-medium text-[#667085] uppercase tracking-wide mb-1">
            Attendance Health
          </p>
          {stats.attendanceRate > 0 ? (
            <>
              <p className={`text-lg font-semibold ${
                stats.attendanceRate >= 80 ? 'text-[#417762]' :
                stats.attendanceRate >= 60 ? 'text-[#F4B03D]' : 'text-red-600'
              }`}>
                {stats.attendanceRate}%
              </p>
              <p className="text-sm text-[#667085]">{stats.attendanceContext}</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-[#667085]">No data yet</p>
              <p className="text-sm text-[#667085]">{stats.attendanceContext || 'First session upcoming'}</p>
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
  );
}
