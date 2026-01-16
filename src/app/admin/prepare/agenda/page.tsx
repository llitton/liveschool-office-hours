'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { PageContainer, PageHeader } from '@/components/AppShell';
import { Card, CardBody } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';

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
          <p className="text-[#667085] mb-4">Select a session to edit its agenda.</p>
          <LinkButton href="/admin/prepare" variant="tertiary">
            Go back to Prepare
          </LinkButton>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <div className="px-6 py-4 border-b border-[#E0E0E0]">
        <h2 className="font-semibold text-[#101E57]">{event.name}</h2>
        <p className="text-sm text-[#667085]">Edit the session description and agenda</p>
      </div>
      <CardBody>
        <p className="text-[#667085] mb-6">
          The session agenda and description can be edited in the event settings.
        </p>
        <LinkButton href={`/admin/events/${event.id}/settings`}>
          Edit event settings
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </LinkButton>
      </CardBody>
    </Card>
  );
}

export default function AgendaPage() {
  return (
    <>
      <PageContainer narrow>
        <PageHeader
          title="Agenda"
          description="Plan what will happen during the session so attendees know what to expect."
          backLink={{ href: '/admin/prepare', label: 'Back to Prepare' }}
        />
        <Suspense fallback={<div className="animate-pulse h-48 bg-gray-200 rounded-xl" />}>
          <AgendaContent />
        </Suspense>
      </PageContainer>
    </>
  );
}
