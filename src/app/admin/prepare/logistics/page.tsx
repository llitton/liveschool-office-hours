'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import AppShell, { PageContainer, PageHeader } from '@/components/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';

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
      <Card>
        <CardBody>
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
            <div className="h-32 bg-gray-100 rounded" />
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!event) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <p className="text-[#667085] mb-4">Select a session to view its logistics.</p>
          <LinkButton href="/admin/prepare" variant="tertiary">
            Go back to Prepare
          </LinkButton>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={event.name}
          description="Session logistics and settings"
          action={
            <LinkButton href={`/admin/events/${event.id}/settings`} variant="tertiary" size="sm">
              Edit settings
            </LinkButton>
          }
        />

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
      </Card>

      <LinkButton href={`/admin/events/${event.id}/settings`} className="w-full justify-center">
        Edit all settings
      </LinkButton>
    </div>
  );
}

export default function LogisticsPage() {
  return (
    <AppShell>
      <PageContainer narrow>
        <PageHeader
          title="Logistics"
          description="Host, capacity, and technical setup for the session."
          backLink={{ href: '/admin/prepare', label: 'Back to Prepare' }}
        />
        <Suspense fallback={<div className="animate-pulse h-48 bg-gray-200 rounded-xl" />}>
          <LogisticsContent />
        </Suspense>
      </PageContainer>
    </AppShell>
  );
}
