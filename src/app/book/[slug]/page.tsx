'use client';

import { useState, useEffect, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import Image from 'next/image';
import type { OHEvent, OHSlot, CustomQuestion } from '@/types';
import SimpleMarkdown from '@/components/SimpleMarkdown';
import { decodeResponses } from '@/lib/routing';

interface SlotWithCount extends OHSlot {
  booking_count: number;
}

interface GroupedSlots {
  [date: string]: SlotWithCount[];
}

// Common timezones grouped by region for the dropdown
const TIMEZONE_OPTIONS = [
  { group: 'North America', zones: [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Phoenix', label: 'Arizona (MST)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
    { value: 'America/Toronto', label: 'Toronto (ET)' },
    { value: 'America/Vancouver', label: 'Vancouver (PT)' },
    { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
  ]},
  { group: 'Europe', zones: [
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET)' },
    { value: 'Europe/Madrid', label: 'Madrid (CET)' },
    { value: 'Europe/Rome', label: 'Rome (CET)' },
    { value: 'Europe/Zurich', label: 'Zurich (CET)' },
    { value: 'Europe/Stockholm', label: 'Stockholm (CET)' },
    { value: 'Europe/Dublin', label: 'Dublin (GMT/IST)' },
  ]},
  { group: 'Asia & Pacific', zones: [
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)' },
    { value: 'Asia/Mumbai', label: 'Mumbai (IST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
  ]},
  { group: 'South America', zones: [
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)' },
    { value: 'America/Bogota', label: 'Bogotá (COT)' },
    { value: 'America/Lima', label: 'Lima (PET)' },
    { value: 'America/Santiago', label: 'Santiago (CLT)' },
  ]},
  { group: 'Africa & Middle East', zones: [
    { value: 'Africa/Cairo', label: 'Cairo (EET)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
    { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
    { value: 'Asia/Jerusalem', label: 'Jerusalem (IST)' },
    { value: 'Asia/Riyadh', label: 'Riyadh (AST)' },
  ]},
];

export default function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const prefillParam = searchParams.get('prefill');
  const preferredHostId = searchParams.get('host');

  const [event, setEvent] = useState<OHEvent | null>(null);
  const [slots, setSlots] = useState<SlotWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Booking flow state
  const [selectedSlot, setSelectedSlot] = useState<SlotWithCount | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    sms_consent: false,
  });
  const [questionResponses, setQuestionResponses] = useState<Record<string, string>>({});
  const [booking, setBooking] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    event: OHEvent;
    slot: { start_time: string; end_time: string; google_meet_link: string | null };
    manage_token?: string;
  } | null>(null);

  // Timezone
  const [timezone, setTimezone] = useState('America/New_York');
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null);

  useEffect(() => {
    // Detect user's timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(userTimezone);
    setDetectedTimezone(userTimezone);
  }, []);

  // Check if detected timezone is in our predefined list
  const isDetectedInList = TIMEZONE_OPTIONS.some(group =>
    group.zones.some(tz => tz.value === detectedTimezone)
  );

  useEffect(() => {
    fetchEventAndSlots();
  }, [slug]);

  // Prefill question responses from routing form if available
  useEffect(() => {
    if (event && prefillParam) {
      const prefillData = decodeResponses(prefillParam);
      if (prefillData) {
        // Match prefill data to custom questions by question text
        const customQuestions = event.custom_questions || [];
        const initialResponses: Record<string, string> = {};

        customQuestions.forEach((q) => {
          // Try to find matching prefill data by question ID or question text
          if (prefillData[q.id]) {
            initialResponses[q.id] = prefillData[q.id];
          } else {
            // Also check if the routing form used the question text as key
            const matchingValue = Object.entries(prefillData).find(
              ([key, value]) => key.toLowerCase() === q.question.toLowerCase()
            );
            if (matchingValue) {
              initialResponses[q.id] = matchingValue[1];
            }
          }
        });

        if (Object.keys(initialResponses).length > 0) {
          setQuestionResponses((prev) => ({ ...prev, ...initialResponses }));
        }
      }
    }
  }, [event, prefillParam]);

  const fetchEventAndSlots = async () => {
    try {
      // First get events to find by slug
      const eventsRes = await fetch('/api/events');
      if (!eventsRes.ok) throw new Error('Failed to load events');

      const events = await eventsRes.json();
      const foundEvent = events.find((e: OHEvent) => e.slug === slug);

      if (!foundEvent) {
        throw new Error('Event not found');
      }

      setEvent(foundEvent);

      // Get slots for this event
      const slotsRes = await fetch(`/api/slots?eventId=${foundEvent.id}`);
      if (!slotsRes.ok) throw new Error('Failed to load available times');

      const slotsData = await slotsRes.json();
      setSlots(slotsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !event) return;

    // Validate required custom questions
    const customQuestions = event.custom_questions || [];
    for (const q of customQuestions) {
      if (q.required && !questionResponses[q.id]?.trim()) {
        setError(`Please answer: ${q.question}`);
        return;
      }
    }

    setBooking(true);
    setError('');

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          ...formData,
          question_responses: questionResponses,
          attendee_timezone: timezone,
          preferred_host_id: preferredHostId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to book');
      }

      setBookingResult(data);
      setBookingComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete booking');
    } finally {
      setBooking(false);
    }
  };

  // Group slots by date
  const groupedSlots: GroupedSlots = slots.reduce((acc, slot) => {
    const date = format(parseISO(slot.start_time), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(slot);
    return acc;
  }, {} as GroupedSlots);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <div className="animate-pulse text-[#667085]">Loading...</div>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <Image
            src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
            alt="LiveSchool"
            width={140}
            height={36}
            className="mx-auto mb-6"
          />
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-[#667085]">
            This booking page may not exist or is no longer available.
          </p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  // Booking complete screen
  if (bookingComplete && bookingResult) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Success header */}
            <div className="bg-[#417762] text-white p-6 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold mb-1">
                You&apos;re all set, {formData.first_name}!
              </h1>
              <p className="text-white/80">
                We&apos;re looking forward to meeting with you
              </p>
            </div>

            <div className="p-6">
              {/* Session details card */}
              <div className="bg-[#F6F6F9] rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#6F71EE]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-[#101E57]">
                      {bookingResult.event.name}
                    </h2>
                    <p className="text-[#667085]">
                      {formatInTimeZone(
                        parseISO(bookingResult.slot.start_time),
                        timezone,
                        'EEEE, MMMM d, yyyy'
                      )}
                    </p>
                    <p className="text-[#101E57] font-medium">
                      {formatInTimeZone(
                        parseISO(bookingResult.slot.start_time),
                        timezone,
                        'h:mm a'
                      )}{' '}
                      -{' '}
                      {formatInTimeZone(
                        parseISO(bookingResult.slot.end_time),
                        timezone,
                        'h:mm a'
                      )}
                    </p>
                    <p className="text-[#667085] text-sm">{timezone}</p>
                  </div>
                </div>

                {bookingResult.slot.google_meet_link && (
                  <a
                    href={bookingResult.slot.google_meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 w-full bg-[#6F71EE] text-white py-2.5 rounded-lg hover:bg-[#5a5cd0] transition font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Join Google Meet
                  </a>
                )}
              </div>

              {/* What happens next */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-[#101E57] mb-3">Here&apos;s what happens next:</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-[#417762] text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">1</div>
                    <div>
                      <p className="text-sm text-[#101E57] font-medium">Check your inbox</p>
                      <p className="text-sm text-[#667085]">Calendar invite sent to <strong>{formData.email}</strong></p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-[#417762] text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">2</div>
                    <div>
                      <p className="text-sm text-[#101E57] font-medium">Add to your calendar</p>
                      <p className="text-sm text-[#667085]">Accept the invite to block the time</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-[#417762] text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">3</div>
                    <div>
                      <p className="text-sm text-[#101E57] font-medium">Join on time</p>
                      <p className="text-sm text-[#667085]">Click the Google Meet link when it&apos;s time</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prep Materials */}
              {event?.prep_materials && (
                <div className="bg-[#6F71EE]/5 border border-[#6F71EE]/20 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-[#101E57] mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Before your session
                  </h3>
                  <div className="text-[#667085] text-sm whitespace-pre-wrap">
                    {event.prep_materials}
                  </div>
                </div>
              )}

              {/* Manage booking link */}
              <div className="text-center pt-4 border-t border-gray-100">
                <p className="text-sm text-[#667085] mb-2">
                  Plans change? No problem.
                </p>
                {bookingResult.manage_token ? (
                  <a
                    href={`/manage/${bookingResult.manage_token}`}
                    className="inline-flex items-center gap-2 text-[#6F71EE] hover:text-[#5a5cd0] font-medium text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Reschedule or cancel your booking
                  </a>
                ) : (
                  <p className="text-sm text-[#667085]">Check your email for reschedule options</p>
                )}
              </div>
            </div>
          </div>

          <div className="text-center mt-6">
            <Image
              src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
              alt="LiveSchool"
              width={100}
              height={26}
              className="mx-auto opacity-60"
            />
          </div>
        </div>
      </div>
    );
  }

  // Booking form screen
  if (selectedSlot) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] py-12 px-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => setSelectedSlot(null)}
            className="text-[#6F71EE] hover:text-[#5a5cd0] mb-4 flex items-center gap-1 font-medium"
          >
            ← Back to times
          </button>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-[#101E57] text-white p-6">
              <Image
                src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
                alt="LiveSchool"
                width={120}
                height={32}
                className="mb-4 brightness-0 invert"
              />
              <h1 className="text-xl font-semibold">{event.name}</h1>
              {event.subtitle && (
                <p className="text-white/80 mt-1">{event.subtitle}</p>
              )}
              <div className="flex items-center gap-2 mt-2 text-white/80">
                {event.host_profile_image ? (
                  <img
                    src={event.host_profile_image}
                    alt={event.host_name}
                    className="w-6 h-6 rounded-full object-cover border border-white/30"
                  />
                ) : null}
                <span>{event.duration_minutes} min · {event.host_name}</span>
              </div>
            </div>

            {/* Selected time */}
            <div className="p-6 border-b bg-[#F6F6F9]">
              <p className="font-medium text-[#101E57]">
                {formatInTimeZone(
                  parseISO(selectedSlot.start_time),
                  timezone,
                  'EEEE, MMMM d, yyyy'
                )}
              </p>
              <p className="text-[#667085]">
                {formatInTimeZone(
                  parseISO(selectedSlot.start_time),
                  timezone,
                  'h:mm a'
                )}{' '}
                -{' '}
                {formatInTimeZone(
                  parseISO(selectedSlot.end_time),
                  timezone,
                  'h:mm a'
                )}
              </p>
              <p className="text-[#667085] text-sm mt-1">{timezone}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleBooking} className="p-6">
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          first_name: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          last_name: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                </div>

                {/* Phone Number and SMS Consent - only show if SMS enabled for this event */}
                {event.sms_reminders_enabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-[#101E57] mb-1">
                        Phone Number {event.sms_phone_required && '*'}
                      </label>
                      <input
                        type="tel"
                        required={event.sms_phone_required}
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        placeholder="+1 (555) 123-4567"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                      />
                      <p className="text-xs text-[#667085] mt-1">
                        For SMS reminders before your session
                      </p>
                    </div>

                    {formData.phone && (
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.sms_consent}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, sms_consent: e.target.checked }))
                          }
                          className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
                        />
                        <span className="text-sm text-[#667085]">
                          I agree to receive SMS reminders about this booking.
                          Message & data rates may apply. Reply STOP to opt out.
                        </span>
                      </label>
                    )}
                  </div>
                )}

                {/* Custom Questions */}
                {event.custom_questions && event.custom_questions.length > 0 && (
                  <div className="pt-4 border-t border-gray-200 space-y-4">
                    {event.custom_questions.map((q: CustomQuestion) => (
                      <div key={q.id}>
                        <label className="block text-sm font-medium text-[#101E57] mb-1">
                          {q.question} {q.required && '*'}
                        </label>
                        {q.type === 'text' && (
                          <input
                            type="text"
                            required={q.required}
                            value={questionResponses[q.id] || ''}
                            onChange={(e) =>
                              setQuestionResponses((prev) => ({
                                ...prev,
                                [q.id]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                          />
                        )}
                        {q.type === 'textarea' && (
                          <textarea
                            required={q.required}
                            rows={3}
                            value={questionResponses[q.id] || ''}
                            onChange={(e) =>
                              setQuestionResponses((prev) => ({
                                ...prev,
                                [q.id]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                          />
                        )}
                        {q.type === 'select' && q.options && (
                          <select
                            required={q.required}
                            value={questionResponses[q.id] || ''}
                            onChange={(e) =>
                              setQuestionResponses((prev) => ({
                                ...prev,
                                [q.id]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                          >
                            <option value="">Select an option</option>
                            {q.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reassurance microcopy */}
              <div className="mt-6 mb-4 p-4 bg-[#F6F6F9] rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#417762]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[#417762]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-sm">
                    <p className="text-[#101E57] font-medium mb-1">What happens next:</p>
                    <ul className="text-[#667085] space-y-1">
                      <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-[#667085] rounded-full" />
                        Calendar invite sent instantly to your email
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-[#667085] rounded-full" />
                        Google Meet link included in the invite
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-[#667085] rounded-full" />
                        You can reschedule or cancel anytime
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={booking}
                className="w-full bg-[#6F71EE] text-white py-3 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
              >
                {booking ? 'Booking...' : 'Confirm Booking'}
              </button>

              <p className="text-xs text-[#667085] mt-3 text-center">
                No commitment required. Free to reschedule if something comes up.
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Main slot selection screen
  return (
    <div className="min-h-screen bg-[#F6F6F9] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Banner Image */}
          {event.banner_image && (
            <div className="relative w-full">
              <Image
                src={event.banner_image}
                alt={event.name}
                width={800}
                height={300}
                className="w-full h-auto"
                priority
              />
            </div>
          )}

          {/* Header */}
          <div className="p-6 border-b">
            <Image
              src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
              alt="LiveSchool"
              width={140}
              height={36}
              className="mb-4"
            />

            <h1 className="text-2xl font-semibold text-[#101E57]">{event.name}</h1>
            {event.subtitle && (
              <p className="text-lg text-[#667085] mt-1">{event.subtitle}</p>
            )}

            <div className="flex flex-wrap gap-4 mt-3 text-[#667085]">
              <span className="flex items-center gap-2">
                {event.host_profile_image ? (
                  <img
                    src={event.host_profile_image}
                    alt={event.host_name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
                {event.host_name}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {event.duration_minutes} min
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Google Meet
              </span>
              {event.meeting_type === 'one_on_one' && (
                <span className="flex items-center gap-1 text-[#6F71EE]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  1-on-1 Session
                </span>
              )}
              {event.meeting_type === 'group' && event.max_attendees > 1 && (
                <span className="flex items-center gap-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Group Session
                </span>
              )}
            </div>

            {event.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <SimpleMarkdown content={event.description} className="text-[#667085]" />
              </div>
            )}

            {/* Booking Rules Info */}
            {(event.min_notice_hours > 0 || event.require_approval) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {event.min_notice_hours > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-[#F6F6F9] text-[#667085] px-2 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {event.min_notice_hours >= 24
                        ? `${Math.floor(event.min_notice_hours / 24)} day${event.min_notice_hours >= 48 ? 's' : ''} advance notice`
                        : `${event.min_notice_hours} hour${event.min_notice_hours > 1 ? 's' : ''} advance notice`}
                    </span>
                  )}
                  {event.require_approval && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Requires approval
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Time slots */}
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
              <h2 className="font-semibold text-[#101E57]">Select a date and time</h2>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 text-[#101E57] focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] bg-white"
                >
                  {/* Show detected timezone at top if not in predefined list */}
                  {detectedTimezone && !isDetectedInList && (
                    <optgroup label="Your Timezone">
                      <option value={detectedTimezone}>
                        {detectedTimezone.replace(/_/g, ' ')}
                      </option>
                    </optgroup>
                  )}
                  {TIMEZONE_OPTIONS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.zones.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {Object.keys(groupedSlots).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#667085]">
                  No available times at the moment. Please check back later.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedSlots).map(([date, dateSlots]) => {
                  // Group by time of day in user's timezone
                  const getTimeOfDay = (slot: SlotWithCount) => {
                    const hour = parseInt(formatInTimeZone(parseISO(slot.start_time), timezone, 'H'));
                    if (hour < 12) return 'morning';
                    if (hour < 17) return 'afternoon';
                    return 'evening';
                  };

                  const morningSlots = dateSlots.filter(s => getTimeOfDay(s) === 'morning');
                  const afternoonSlots = dateSlots.filter(s => getTimeOfDay(s) === 'afternoon');
                  const eveningSlots = dateSlots.filter(s => getTimeOfDay(s) === 'evening');

                  const renderSlots = (slotsGroup: SlotWithCount[], label: string, icon: string) => {
                    if (slotsGroup.length === 0) return null;

                    // For one-on-one, filter out booked slots entirely
                    const isOneOnOne = event.meeting_type === 'one_on_one';
                    const availableSlots = isOneOnOne
                      ? slotsGroup.filter(s => s.booking_count === 0)
                      : slotsGroup;

                    if (availableSlots.length === 0) return null;

                    return (
                      <div className="mb-3">
                        <p className="text-xs text-[#667085] mb-2 flex items-center gap-1">
                          <span>{icon}</span> {label}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {availableSlots.map((slot) => {
                            const isFull = slot.booking_count >= event.max_attendees;
                            const spotsLeft = event.max_attendees - slot.booking_count;
                            const showSpotsLeft = !isOneOnOne && event.max_attendees > 1 && spotsLeft < event.max_attendees && spotsLeft > 0;

                            return (
                              <button
                                key={slot.id}
                                onClick={() => !isFull && setSelectedSlot(slot)}
                                disabled={isFull}
                                className={`px-4 py-2 rounded-lg border transition font-medium ${
                                  isFull
                                    ? 'bg-gray-100 text-[#667085] cursor-not-allowed border-gray-200'
                                    : 'border-[#6F71EE] text-[#6F71EE] hover:bg-[#6F71EE] hover:text-white'
                                }`}
                              >
                                <span>{formatInTimeZone(parseISO(slot.start_time), timezone, 'h:mm a')}</span>
                                {isFull && ' (Full)'}
                                {showSpotsLeft && (
                                  <span className="ml-1 text-xs opacity-75">
                                    ({spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left)
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div key={date}>
                      <h3 className="font-medium text-[#101E57] mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatInTimeZone(parseISO(dateSlots[0].start_time), timezone, 'EEEE, MMMM d, yyyy')}
                      </h3>
                      {renderSlots(morningSlots, 'Morning', '☀️')}
                      {renderSlots(afternoonSlots, 'Afternoon', '🌤️')}
                      {renderSlots(eveningSlots, 'Evening', '🌙')}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="p-4 bg-[#F6F6F9] border-t text-center">
            <p className="text-sm text-[#667085]">
              Web conferencing details provided upon confirmation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
