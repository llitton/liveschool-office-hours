'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import { MEETING_TYPE_LABELS, MeetingType } from '@/types';

interface EventLink {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  duration_minutes: number;
  meeting_type: MeetingType;
  max_attendees: number;
  upcoming_slots: number;
  booking_url: string;
}

interface AdminInfo {
  name: string | null;
  email: string;
  profile_image: string | null;
}

export default function MyLinksPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [events, setEvents] = useState<EventLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/my-links/${token}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('This link is invalid or has expired.');
        }
        throw new Error('Failed to load your links');
      }
      const data = await response.json();
      setAdmin(data.admin);
      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (url: string, eventId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(eventId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getMeetingTypeIcon = (type: MeetingType) => {
    switch (type) {
      case 'one_on_one':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'group':
      case 'webinar':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'round_robin':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <div className="animate-pulse text-[#667085]">Loading your links...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-[#101E57] mb-2">Link Not Found</h1>
          <p className="text-[#667085]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Image
            src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
            alt="LiveSchool"
            width={100}
            height={26}
          />
          <span className="text-[#667085]">|</span>
          <span className="text-[#101E57] font-medium">My Booking Links</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* User Info */}
        <div className="flex items-center gap-4 mb-8">
          {admin?.profile_image ? (
            <Image
              src={admin.profile_image}
              alt={admin.name || 'Profile'}
              width={48}
              height={48}
              className="rounded-full"
            />
          ) : (
            <div className="w-12 h-12 bg-[#6F71EE] rounded-full flex items-center justify-center text-white font-semibold text-lg">
              {(admin?.name || admin?.email || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-[#101E57]">
              {admin?.name || admin?.email?.split('@')[0] || 'Your'} Booking Links
            </h1>
            <p className="text-sm text-[#667085]">
              {events.length} active {events.length === 1 ? 'event' : 'events'}
            </p>
          </div>
        </div>

        {/* Quick Tip */}
        <div className="bg-[#6F71EE]/5 border border-[#6F71EE]/20 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-[#6F71EE] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-[#101E57] font-medium">Tip: Bookmark this page</p>
              <p className="text-sm text-[#667085]">
                Add this page to your bookmarks for quick access to all your scheduling links.
              </p>
            </div>
          </div>
        </div>

        {/* Events List */}
        {events.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[#101E57] mb-2">No Active Events</h2>
            <p className="text-[#667085]">
              You don&apos;t have any active booking events yet. Create one in the admin dashboard.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-[#6F71EE]/30 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[#6F71EE]">{getMeetingTypeIcon(event.meeting_type)}</span>
                      <h3 className="font-semibold text-[#101E57] truncate">{event.name}</h3>
                    </div>
                    {event.subtitle && (
                      <p className="text-sm text-[#667085] mb-2 line-clamp-1">{event.subtitle}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#667085]">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {event.duration_minutes} min
                      </span>
                      <span className="flex items-center gap-1">
                        {MEETING_TYPE_LABELS[event.meeting_type] || event.meeting_type}
                      </span>
                      {event.upcoming_slots > 0 && (
                        <span className="flex items-center gap-1 text-[#417762]">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {event.upcoming_slots} upcoming
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => copyToClipboard(event.booking_url, event.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                        copiedId === event.id
                          ? 'bg-green-100 text-green-700'
                          : 'bg-[#F6F6F9] text-[#667085] hover:bg-gray-200'
                      }`}
                    >
                      {copiedId === event.id ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                    <a
                      href={event.booking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[#6F71EE] text-white rounded-lg text-sm font-medium hover:bg-[#5a5cd0] transition flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open
                    </a>
                  </div>
                </div>

                {/* URL Preview */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 bg-[#F6F6F9] rounded px-3 py-2">
                    <svg className="w-4 h-4 text-[#667085] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <code className="text-xs text-[#667085] truncate flex-1">{event.booking_url}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-[#667085]">
          <p>
            Need to manage your events?{' '}
            <a href="/admin" className="text-[#6F71EE] hover:underline">
              Go to Admin Dashboard
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
