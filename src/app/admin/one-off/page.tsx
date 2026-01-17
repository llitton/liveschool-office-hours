'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

interface OneOffMeeting {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  single_use: boolean;
  one_off_expires_at: string | null;
  one_off_booked_at: string | null;
  created_at: string;
  status: 'active' | 'booked' | 'expired';
  total_slots: number;
  booked_slots: number;
  slots: Array<{
    id: string;
    start_time: string;
    end_time: string;
    is_cancelled: boolean;
    bookings: Array<{ count: number }>;
  }>;
}

export default function OneOffMeetingsPage() {
  const [meetings, setMeetings] = useState<OneOffMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const res = await fetch('/api/one-off');
      if (!res.ok) throw new Error('Failed to fetch meetings');
      const data = await res.json();
      setMeetings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async (slug: string) => {
    const url = `${window.location.origin}/book/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(slug);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteMeeting = async (id: string) => {
    if (!confirm('Are you sure you want to delete this meeting link?')) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/one-off?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete meeting');
      setMeetings((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Active
          </span>
        );
      case 'booked':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Booked
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Expired
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#101E57]">One-off Meetings</h1>
          <p className="text-[#667085] mt-1">
            Quick scheduling links for one-time meetings
          </p>
        </div>
        <Link
          href="/admin/one-off/new"
          className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New One-off Meeting
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {meetings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="w-16 h-16 bg-[#6F71EE]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">No one-off meetings yet</h2>
          <p className="text-[#667085] mb-6 max-w-md mx-auto">
            Create a quick scheduling link to share specific times with someone.
            Perfect for one-time meetings that don&apos;t need a recurring event.
          </p>
          <Link
            href="/admin/one-off/new"
            className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-6 py-3 rounded-lg hover:bg-[#5a5cd0] transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First One-off Meeting
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Meeting
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Times Offered
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {meetings.map((meeting) => (
                <tr key={meeting.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-[#101E57]">{meeting.name}</p>
                      <p className="text-sm text-[#667085]">
                        {meeting.duration_minutes} min
                        {meeting.single_use && (
                          <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            Single use
                          </span>
                        )}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      {meeting.slots.slice(0, 2).map((slot, i) => (
                        <p key={slot.id} className="text-[#667085]">
                          {format(parseISO(slot.start_time), 'MMM d, h:mm a')}
                        </p>
                      ))}
                      {meeting.slots.length > 2 && (
                        <p className="text-[#667085] text-xs">
                          +{meeting.slots.length - 2} more times
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(meeting.status)}
                    {meeting.one_off_expires_at && meeting.status === 'active' && (
                      <p className="text-xs text-[#667085] mt-1">
                        Expires {format(parseISO(meeting.one_off_expires_at), 'MMM d')}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#667085]">
                    {format(parseISO(meeting.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {meeting.status === 'active' && (
                        <button
                          onClick={() => copyLink(meeting.slug)}
                          className="p-2 text-[#667085] hover:text-[#6F71EE] hover:bg-[#6F71EE]/10 rounded-lg transition"
                          title="Copy link"
                        >
                          {copiedId === meeting.slug ? (
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => deleteMeeting(meeting.id)}
                        disabled={deleting === meeting.id}
                        className="p-2 text-[#667085] hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === meeting.id ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Help text */}
      <div className="mt-6 bg-[#F6F6F9] rounded-lg p-4">
        <h3 className="font-medium text-[#101E57] mb-2">How one-off meetings work</h3>
        <ul className="text-sm text-[#667085] space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE]">1.</span>
            Create a meeting with specific time options you want to offer
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE]">2.</span>
            Share the link with the person you want to meet with
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE]">3.</span>
            They pick a time and book directly - calendar invites sent automatically
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE]">4.</span>
            <strong>Single-use links</strong> expire after the first booking (great for specific scheduling)
          </li>
        </ul>
      </div>
    </div>
  );
}
