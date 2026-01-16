'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import AdminHeader from '@/components/AdminHeader';

interface Event {
  id: string;
  name: string;
  slug: string;
  host_name: string;
  host_email: string | null;
  duration_minutes: number;
  max_attendees: number;
  location: string | null;
}

function LogisticsContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) {
      fetch(`/api/events/${eventId}`)
        .then(res => res.json())
        .then(data => {
          setEvent(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [eventId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E0E0E0] p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
        <div className="h-32 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-white rounded-xl border border-[#E0E0E0] p-8 text-center">
        <p className="text-[#667085]">Select a session to view its logistics.</p>
        <Link href="/admin/prepare" className="text-[#6F71EE] font-medium hover:underline mt-2 inline-block">
          Go back to Prepare
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E0E0E0] flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[#101E57]">{event.name}</h2>
            <p className="text-sm text-[#667085]">Session logistics and settings</p>
          </div>
          <Link
            href={`/admin/events/${event.id}/settings`}
            className="text-sm text-[#6F71EE] hover:underline font-medium"
          >
            Edit settings
          </Link>
        </div>

        <div className="divide-y divide-[#E0E0E0]">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-[#667085]">Host</p>
              <p className="font-medium text-[#101E57]">{event.host_name}</p>
              {event.host_email && (
                <p className="text-sm text-[#667085]">{event.host_email}</p>
              )}
            </div>
            <div className="w-10 h-10 bg-[#6F71EE]/10 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>

          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-[#667085]">Duration</p>
              <p className="font-medium text-[#101E57]">{event.duration_minutes} minutes</p>
            </div>
            <div className="w-10 h-10 bg-[#6F71EE]/10 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-[#667085]">Capacity</p>
              <p className="font-medium text-[#101E57]">{event.max_attendees} attendee{event.max_attendees !== 1 ? 's' : ''} per session</p>
            </div>
            <div className="w-10 h-10 bg-[#6F71EE]/10 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>

          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-[#667085]">Location</p>
              <p className="font-medium text-[#101E57]">{event.location || 'Google Meet (auto-generated)'}</p>
            </div>
            <div className="w-10 h-10 bg-[#6F71EE]/10 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <Link
        href={`/admin/events/${event.id}/settings`}
        className="block w-full text-center bg-[#101E57] text-white px-5 py-3 rounded-xl font-medium hover:bg-[#1a2d6e] transition"
      >
        Edit all settings
      </Link>
    </div>
  );
}

export default function LogisticsPage() {
  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <AdminHeader email="" />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin/prepare" className="text-sm text-[#6F71EE] hover:underline flex items-center gap-1 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Prepare
          </Link>
          <h1 className="text-2xl font-bold text-[#101E57] mb-2">Logistics</h1>
          <p className="text-[#667085]">
            Host, capacity, and technical setup for the session.
          </p>
        </div>

        <Suspense fallback={<div className="animate-pulse h-48 bg-gray-200 rounded" />}>
          <LogisticsContent />
        </Suspense>
      </main>
    </div>
  );
}
