'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import AdminHeader from '@/components/AdminHeader';

interface Event {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

function AgendaContent() {
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
        <p className="text-[#667085]">Select a session to edit its agenda.</p>
        <Link href="/admin/prepare" className="text-[#6F71EE] font-medium hover:underline mt-2 inline-block">
          Go back to Prepare
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E0E0E0]">
        <h2 className="font-semibold text-[#101E57]">{event.name}</h2>
        <p className="text-sm text-[#667085]">Edit the session description and agenda</p>
      </div>
      <div className="p-6">
        <p className="text-[#667085] mb-6">
          The session agenda and description can be edited in the event settings.
        </p>
        <Link
          href={`/admin/events/${event.id}/settings`}
          className="inline-flex items-center gap-2 bg-[#101E57] text-white px-5 py-2.5 rounded-lg font-medium hover:bg-[#1a2d6e] transition"
        >
          Edit event settings
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

export default function AgendaPage() {
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
          <h1 className="text-2xl font-bold text-[#101E57] mb-2">Agenda</h1>
          <p className="text-[#667085]">
            Plan what will happen during the session so attendees know what to expect.
          </p>
        </div>

        <Suspense fallback={<div className="animate-pulse h-48 bg-gray-200 rounded" />}>
          <AgendaContent />
        </Suspense>
      </main>
    </div>
  );
}
