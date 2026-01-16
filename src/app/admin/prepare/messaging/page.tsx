'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { PageContainer, PageHeader } from '@/components/AppShell';
import { Card, CardBody, CalloutCard } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';

interface Event {
  id: string;
  name: string;
  slug: string;
  confirmation_subject: string | null;
  confirmation_body: string | null;
  reminder_subject: string | null;
  reminder_body: string | null;
}

function MessagingContent() {
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
          <p className="text-[#667085] mb-4">Select a session to configure its messaging.</p>
          <LinkButton href="/admin/prepare" variant="tertiary">
            Go back to Prepare
          </LinkButton>
        </CardBody>
      </Card>
    );
  }

  const hasConfirmation = event.confirmation_subject || event.confirmation_body;
  const hasReminder = event.reminder_subject || event.reminder_body;

  return (
    <div className="space-y-6">
      {/* Confirmation email */}
      <Card>
        <div className="px-6 py-4 border-b border-[#E0E0E0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasConfirmation ? 'bg-[#ECFDF5]' : 'bg-[#FEF3C7]'}`}>
              {hasConfirmation ? (
                <svg className="w-4 h-4 text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-[#D97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-[#101E57]">Confirmation email</h3>
              <p className="text-sm text-[#667085]">Sent immediately after booking</p>
            </div>
          </div>
          <LinkButton href={`/admin/events/${event.id}/emails`} variant="tertiary" size="sm">
            Edit
          </LinkButton>
        </div>
        <CardBody>
          {hasConfirmation ? (
            <div className="bg-[#F6F6F9] rounded-lg p-4">
              <p className="text-sm font-medium text-[#101E57] mb-1">Subject</p>
              <p className="text-[#667085] text-sm">{event.confirmation_subject || 'Default subject'}</p>
            </div>
          ) : (
            <p className="text-[#667085] text-sm">
              Using default confirmation template. Customize to match your brand.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Reminder email */}
      <Card>
        <div className="px-6 py-4 border-b border-[#E0E0E0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasReminder ? 'bg-[#ECFDF5]' : 'bg-[#FEF3C7]'}`}>
              {hasReminder ? (
                <svg className="w-4 h-4 text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-[#D97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-[#101E57]">Reminder email</h3>
              <p className="text-sm text-[#667085]">Sent 24 hours and 1 hour before</p>
            </div>
          </div>
          <LinkButton href={`/admin/events/${event.id}/emails`} variant="tertiary" size="sm">
            Edit
          </LinkButton>
        </div>
        <CardBody>
          {hasReminder ? (
            <div className="bg-[#F6F6F9] rounded-lg p-4">
              <p className="text-sm font-medium text-[#101E57] mb-1">Subject</p>
              <p className="text-[#667085] text-sm">{event.reminder_subject || 'Default subject'}</p>
            </div>
          ) : (
            <p className="text-[#667085] text-sm">
              Using default reminder template. Customize to improve attendance.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Tips */}
      <CalloutCard>
        <h3 className="font-medium text-[#101E57] mb-2">Tips for effective messaging</h3>
        <ul className="space-y-2 text-sm text-[#667085]">
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE] mt-1">•</span>
            Use the attendee's first name in the subject line
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE] mt-1">•</span>
            Include clear instructions for joining the session
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE] mt-1">•</span>
            Set expectations about what will happen
          </li>
        </ul>
      </CalloutCard>

      <LinkButton href={`/admin/events/${event.id}/emails`} className="w-full justify-center">
        Edit email templates
      </LinkButton>
    </div>
  );
}

export default function MessagingPage() {
  return (
    <>
      <PageContainer narrow>
        <PageHeader
          title="Messaging"
          description="Confirmation and reminder emails sent to attendees."
          backLink={{ href: '/admin/prepare', label: 'Back to Prepare' }}
        />
        <Suspense fallback={<div className="animate-pulse h-48 bg-gray-200 rounded-xl" />}>
          <MessagingContent />
        </Suspense>
      </PageContainer>
    </>
  );
}
