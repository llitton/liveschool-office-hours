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
  const [linkCopied, setLinkCopied] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchStats();
    // Load dismissed alerts from localStorage
    const stored = localStorage.getItem('dismissedDashboardAlerts');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Clear dismissals older than 24 hours
        const now = Date.now();
        const validDismissals = Object.entries(parsed)
          .filter(([, timestamp]) => now - (timestamp as number) < 24 * 60 * 60 * 1000)
          .map(([key]) => key);
        setDismissedAlerts(new Set(validDismissals));
      } catch {
        // Invalid stored data, ignore
      }
    }
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

  const copyBookingLink = () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}/book`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const dismissAlert = (alertType: string) => {
    const newDismissed = new Set(dismissedAlerts);
    newDismissed.add(alertType);
    setDismissedAlerts(newDismissed);

    // Store with timestamp for auto-expiry
    const stored = localStorage.getItem('dismissedDashboardAlerts');
    const existing = stored ? JSON.parse(stored) : {};
    existing[alertType] = Date.now();
    localStorage.setItem('dismissedDashboardAlerts', JSON.stringify(existing));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="animate-pulse h-16 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!stats) return null;

  const isSetupComplete = stats.setupComplete >= stats.setupTotal;
  const incompleteSetupItems = stats.setupItems.filter(item => !item.completed);

  // Filter out dismissed alerts and consolidate - show max 1 alert
  const visibleActionItems = stats.actionItems?.filter(item => !dismissedAlerts.has(item.type)) || [];
  const topActionItem = visibleActionItems[0];
  const additionalActionsCount = visibleActionItems.length - 1;

  return (
    <div className="mb-6">
      {/* Setup incomplete - show minimal checklist */}
      {!isSetupComplete && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#101E57]">
                {stats.setupComplete}/{stats.setupTotal} setup complete
              </h2>
              <p className="text-sm text-[#667085]">
                {incompleteSetupItems[0]?.label}
              </p>
            </div>
            <Link
              href={incompleteSetupItems[0]?.link || '/admin'}
              className="px-4 py-2 bg-[#6F71EE] text-white text-sm font-medium rounded-lg hover:bg-[#5a5cd0] transition"
            >
              Continue Setup
            </Link>
          </div>
        </div>
      )}

      {/* Setup complete - show status + primary action */}
      {isSetupComplete && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          {/* Single consolidated alert (if any) - dismissible */}
          {topActionItem && (
            <div className={`flex items-center justify-between p-3 rounded-lg mb-4 ${
              topActionItem.priority === 'high' ? 'bg-red-50' :
              topActionItem.priority === 'medium' ? 'bg-amber-50' : 'bg-blue-50'
            }`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${
                  topActionItem.priority === 'high' ? 'bg-red-500' :
                  topActionItem.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <span className={`text-sm font-medium truncate ${
                  topActionItem.priority === 'high' ? 'text-red-800' :
                  topActionItem.priority === 'medium' ? 'text-amber-800' : 'text-blue-800'
                }`}>
                  {topActionItem.title}
                  {additionalActionsCount > 0 && (
                    <span className="font-normal text-[#667085]"> (+{additionalActionsCount} more)</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={topActionItem.link}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition ${
                    topActionItem.priority === 'high' ? 'bg-red-600 text-white hover:bg-red-700' :
                    topActionItem.priority === 'medium' ? 'bg-amber-600 text-white hover:bg-amber-700' :
                    'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {topActionItem.cta}
                </Link>
                <button
                  onClick={() => dismissAlert(topActionItem.type)}
                  className={`p-1 rounded-md transition ${
                    topActionItem.priority === 'high' ? 'text-red-400 hover:text-red-600 hover:bg-red-100' :
                    topActionItem.priority === 'medium' ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-100' :
                    'text-blue-400 hover:text-blue-600 hover:bg-blue-100'
                  }`}
                  title="Dismiss for 24 hours"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Status row */}
          <div className="flex items-center justify-between">
            <div>
              {stats.nextSession ? (
                <Link href={`/admin/events/${stats.nextSession.event_id}`} className="group">
                  <p className="text-lg font-semibold text-[#101E57] group-hover:text-[#6F71EE] transition">
                    Next: {format(parseISO(stats.nextSession.start_time), 'EEE h:mm a')}
                  </p>
                  <p className="text-sm text-[#667085]">
                    {stats.nextSession.booked > 0
                      ? `${stats.nextSession.booked} booked`
                      : 'No bookings yet'
                    }
                    {' · '}
                    {formatDistanceToNow(parseISO(stats.nextSession.start_time), { addSuffix: true })}
                  </p>
                </Link>
              ) : (
                <div>
                  <p className="text-lg font-semibold text-[#101E57]">You&apos;re all set</p>
                  <p className="text-sm text-[#667085]">
                    {stats.upcomingSessions} upcoming session{stats.upcomingSessions !== 1 ? 's' : ''}
                    {stats.openCapacity > 0 && ` · ${stats.openCapacity} seats open`}
                  </p>
                </div>
              )}
            </div>

            {/* Primary CTA */}
            <button
              onClick={copyBookingLink}
              className="flex items-center gap-2 px-4 py-2 bg-[#6F71EE] text-white text-sm font-medium rounded-lg hover:bg-[#5a5cd0] transition"
            >
              {linkCopied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share Booking Link
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
