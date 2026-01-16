'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import AdminHeader from '@/components/AdminHeader';

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
      <div className="bg-white rounded-xl border border-[#E0E0E0] p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
        <div className="h-32 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-white rounded-xl border border-[#E0E0E0] p-8 text-center">
        <p className="text-[#667085]">Select a session to configure its messaging.</p>
        <Link href="/admin/prepare" className="text-[#6F71EE] font-medium hover:underline mt-2 inline-block">
          Go back to Prepare
        </Link>
      </div>
    );
  }

  const hasConfirmation = event.confirmation_subject || event.confirmation_body;
  const hasReminder = event.reminder_subject || event.reminder_body;

  return (
    <div className="space-y-6">
      {/* Confirmation email */}
      <div className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E0E0E0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasConfirmation ? 'bg-green-50' : 'bg-amber-50'}`}>
              {hasConfirmation ? (
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-[#101E57]">Confirmation email</h3>
              <p className="text-sm text-[#667085]">Sent immediately after booking</p>
            </div>
          </div>
          <Link
            href={`/admin/events/${event.id}/emails`}
            className="text-sm text-[#6F71EE] hover:underline font-medium"
          >
            Edit
          </Link>
        </div>
        <div className="p-6">
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
        </div>
      </div>

      {/* Reminder email */}
      <div className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E0E0E0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasReminder ? 'bg-green-50' : 'bg-amber-50'}`}>
              {hasReminder ? (
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-[#101E57]">Reminder email</h3>
              <p className="text-sm text-[#667085]">Sent 24 hours and 1 hour before</p>
            </div>
          </div>
          <Link
            href={`/admin/events/${event.id}/emails`}
            className="text-sm text-[#6F71EE] hover:underline font-medium"
          >
            Edit
          </Link>
        </div>
        <div className="p-6">
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
        </div>
      </div>

      {/* Tips */}
      <div className="bg-[#FAFAFA] rounded-xl border border-[#E0E0E0] p-5">
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
      </div>

      <Link
        href={`/admin/events/${event.id}/emails`}
        className="block w-full text-center bg-[#101E57] text-white px-5 py-3 rounded-xl font-medium hover:bg-[#1a2d6e] transition"
      >
        Edit email templates
      </Link>
    </div>
  );
}

export default function MessagingPage() {
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
          <h1 className="text-2xl font-bold text-[#101E57] mb-2">Messaging</h1>
          <p className="text-[#667085]">
            Confirmation and reminder emails sent to attendees.
          </p>
        </div>

        <Suspense fallback={<div className="animate-pulse h-48 bg-gray-200 rounded" />}>
          <MessagingContent />
        </Suspense>
      </main>
    </div>
  );
}
