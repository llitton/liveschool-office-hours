'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, parseISO, areIntervalsOverlapping } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import Image from 'next/image';
import type { OHEvent, OHSlot, CustomQuestion, BusyTimeBlock } from '@/types';
import { decodeResponses } from '@/lib/routing';
import { TroubleshootModal } from '@/components/TroubleshootModal';
import { AttendeeCalendarConnect } from '@/components/AttendeeCalendarConnect';
import { useBookingAnalytics } from '@/hooks/useBookingAnalytics';

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

  // Email validation state
  const [emailValidating, setEmailValidating] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phonePrefilled, setPhonePrefilled] = useState(false);
  const [contactLookupDone, setContactLookupDone] = useState(false);

  // Guest emails state
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [guestEmailInput, setGuestEmailInput] = useState('');
  const [guestEmailError, setGuestEmailError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    event: OHEvent;
    slot: { start_time: string; end_time: string; google_meet_link: string | null };
    manage_token?: string;
    is_waitlisted?: boolean;
    waitlist_position?: number | null;
    integrations?: {
      calendar: 'sent' | 'failed' | 'skipped';
      email: 'sent' | 'failed' | 'skipped';
      calendarError?: string;
      emailError?: string;
    };
  } | null>(null);

  // Timezone
  const [timezone, setTimezone] = useState('America/New_York');
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null);

  // Progressive disclosure - show one week of slots at a time
  const [visibleWeeks, setVisibleWeeks] = useState(1);

  // Admin troubleshoot modal
  const [isAdmin, setIsAdmin] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  // Attendee calendar overlay
  const [attendeeBusyTimes, setAttendeeBusyTimes] = useState<BusyTimeBlock[]>([]);

  // Timezone dropdown visibility
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);

  // Date picker for jumping to specific dates
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Form started tracking ref
  const formStartedRef = useRef(false);

  // Analytics tracking
  const analytics = useBookingAnalytics({
    eventSlug: slug,
    eventId: event?.id,
    eventName: event?.name,
  });

  useEffect(() => {
    // Detect user's timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(userTimezone);
    setDetectedTimezone(userTimezone);

    // Check if user is an admin (for troubleshoot access)
    fetch('/api/admin/me')
      .then((res) => res.ok && res.json())
      .then((data) => {
        if (data?.email) setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  // Check if detected timezone is in our predefined list
  const isDetectedInList = TIMEZONE_OPTIONS.some(group =>
    group.zones.some(tz => tz.value === detectedTimezone)
  );

  useEffect(() => {
    fetchEventAndSlots();
  }, [slug]);

  // Track page view when event data loads
  useEffect(() => {
    if (event) {
      analytics.trackPageView();
    }
  }, [event, analytics]);

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

      // Get available times for this event
      // Uses dynamic availability for non-webinars, pre-created slots for webinars
      const timesRes = await fetch(`/api/events/${foundEvent.id}/available-times`);
      if (!timesRes.ok) throw new Error('Failed to load available times');

      const timesData = await timesRes.json();
      setSlots(timesData.slots || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Email validation and HubSpot contact lookup on blur
  const handleEmailBlur = async () => {
    const email = formData.email.trim().toLowerCase();
    if (!email) return;

    setEmailValidating(true);
    setEmailError(null);

    try {
      // Validate email format and check for disposable/MX
      const validateRes = await fetch('/api/validate/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const validation = await validateRes.json();

      if (!validation.valid) {
        setEmailError(validation.error || 'Invalid email address');
        setEmailValidating(false);
        return;
      }

      // If phone field is visible and not already filled, check HubSpot for contact
      const showPhoneField = event?.phone_required || event?.sms_reminders_enabled;
      if (showPhoneField && !formData.phone && !contactLookupDone) {
        try {
          const lookupRes = await fetch('/api/contacts/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          const contact = await lookupRes.json();

          if (contact.found) {
            // Pre-fill phone if available
            if (contact.phone) {
              setFormData(prev => ({ ...prev, phone: contact.phone }));
              setPhonePrefilled(true);
            }
            // Optionally pre-fill name if empty
            if (!formData.first_name && contact.firstName) {
              setFormData(prev => ({ ...prev, first_name: contact.firstName }));
            }
            if (!formData.last_name && contact.lastName) {
              setFormData(prev => ({ ...prev, last_name: contact.lastName }));
            }
          }
          setContactLookupDone(true);
        } catch (lookupErr) {
          console.error('Contact lookup failed:', lookupErr);
        }
      }
    } catch (err) {
      console.error('Email validation error:', err);
    } finally {
      setEmailValidating(false);
    }
  };

  // Add a guest email with validation
  const handleAddGuestEmail = async () => {
    const email = guestEmailInput.trim().toLowerCase();
    if (!email) return;

    // Check if already added
    if (guestEmails.includes(email)) {
      setGuestEmailError('This email has already been added');
      return;
    }

    // Check if it's the same as the booker's email
    if (email === formData.email.trim().toLowerCase()) {
      setGuestEmailError('This is your email - add a different guest');
      return;
    }

    // Check guest limit
    if (event?.guest_limit && guestEmails.length >= event.guest_limit) {
      setGuestEmailError(`Maximum ${event.guest_limit} guests allowed`);
      return;
    }

    setGuestEmailError(null);

    // Validate email (full check including MX records for typo detection)
    try {
      const validateRes = await fetch('/api/validate/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const validation = await validateRes.json();

      if (!validation.valid) {
        setGuestEmailError(validation.error || 'Invalid email address');
        return;
      }

      // Add to list
      setGuestEmails((prev) => [...prev, email]);
      setGuestEmailInput('');
    } catch (err) {
      setGuestEmailError('Failed to validate email');
    }
  };

  const handleRemoveGuestEmail = (email: string) => {
    setGuestEmails((prev) => prev.filter((e) => e !== email));
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

    // Track form submission
    analytics.trackFormSubmit();

    try {
      // Check if this is a dynamic slot (non-webinar events use dynamic availability)
      const isDynamicSlot = selectedSlot.id.startsWith('dynamic-');

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          event_id: isDynamicSlot ? event.id : undefined, // Required for dynamic slots
          ...formData,
          question_responses: questionResponses,
          attendee_timezone: timezone,
          preferred_host_id: preferredHostId || undefined,
          guest_emails: guestEmails.length > 0 ? guestEmails : undefined,
          analytics_session_id: analytics.getSessionId(), // Link booking to analytics session
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Failed to book';
        analytics.trackBookingFailed('BOOKING_ERROR', errorMessage);
        throw new Error(errorMessage);
      }

      // Track successful booking
      if (data.booking?.id) {
        analytics.trackBookingCreated(data.booking.id);
      }

      setBookingResult(data);
      setBookingComplete(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete booking';
      setError(errorMessage);
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

  // Check if one-off meeting link is expired or already booked
  const isOneOffExpired = event.is_one_off && event.one_off_expires_at && new Date(event.one_off_expires_at) < new Date();
  const isOneOffBooked = event.is_one_off && event.single_use && event.one_off_booked_at;

  if (isOneOffExpired || isOneOffBooked) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow text-center max-w-md">
          <Image
            src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
            alt="LiveSchool"
            width={140}
            height={36}
            className="mx-auto mb-6"
          />
          <div className="w-16 h-16 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-[#101E57] mb-2">
            {isOneOffBooked ? 'This link has already been used' : 'This link has expired'}
          </h1>
          <p className="text-[#667085]">
            {isOneOffBooked
              ? 'This meeting link was for a single use and has already been booked.'
              : 'This meeting link is no longer available.'}
          </p>
          <p className="text-[#667085] mt-4">
            Please contact the host if you need to schedule a meeting.
          </p>
        </div>
      </div>
    );
  }

  // Booking complete screen
  if (bookingComplete && bookingResult) {
    const isWaitlisted = bookingResult.is_waitlisted;

    const handleCopyMeetLink = async () => {
      if (bookingResult.slot.google_meet_link) {
        await navigator.clipboard.writeText(bookingResult.slot.google_meet_link);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    };

    // Generate calendar URLs for easy access
    const calendarEvent = {
      title: bookingResult.event.name,
      description: `${bookingResult.event.description || ''}\n\n${bookingResult.slot.google_meet_link ? `Join: ${bookingResult.slot.google_meet_link}` : ''}`.trim(),
      location: bookingResult.slot.google_meet_link || 'Google Meet',
      startTime: parseISO(bookingResult.slot.start_time),
      endTime: parseISO(bookingResult.slot.end_time),
    };

    // Simple calendar URL generators (inline to avoid import complexity)
    const formatDateForCal = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calendarEvent.title)}&dates=${formatDateForCal(calendarEvent.startTime)}/${formatDateForCal(calendarEvent.endTime)}&details=${encodeURIComponent(calendarEvent.description)}&location=${encodeURIComponent(calendarEvent.location)}`;
    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(calendarEvent.title)}&startdt=${calendarEvent.startTime.toISOString()}&enddt=${calendarEvent.endTime.toISOString()}&body=${encodeURIComponent(calendarEvent.description)}&location=${encodeURIComponent(calendarEvent.location)}`;

    return (
      <div className="min-h-screen bg-[#F6F6F9] py-12 px-4">
        <div className="mx-auto max-w-[650px]">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Header - improved visual hierarchy */}
            <div className={`${isWaitlisted ? 'bg-amber-50' : 'bg-[#417762]'} p-8`}>
              {isWaitlisted ? (
                // Waitlist header
                <div className="text-center">
                  <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-[bounce_0.6s_ease-in-out]">
                    <span className="text-2xl font-bold text-amber-600">#{bookingResult.waitlist_position}</span>
                  </div>
                  <h1 className="text-2xl font-semibold text-amber-800">
                    You&apos;re on the waitlist
                  </h1>
                  <div className="mt-3 inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {formData.email}
                  </div>
                </div>
              ) : (
                // Confirmed booking header - larger checkmark with animation
                <div className="text-center text-white">
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-semibold">
                    You&apos;re booked, {formData.first_name}!
                  </h1>
                  {/* Email verification pill - high contrast */}
                  <div className="mt-3 inline-flex items-center gap-2 bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {formData.email}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6">
              {/* Reschedule/Cancel - moved higher, more prominent */}
              {bookingResult.manage_token && !isWaitlisted && (
                <div className="flex items-center justify-between bg-[#F6F6F9] rounded-lg px-4 py-3 mb-5">
                  <span className="text-sm text-[#667085]">Made a mistake?</span>
                  <a
                    href={`/manage/${bookingResult.manage_token}`}
                    className="text-sm font-medium text-[#6F71EE] hover:text-[#5a5cd0] flex items-center gap-1"
                  >
                    Reschedule or cancel
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              )}

              {/* Integration warnings - show if calendar or email failed */}
              {bookingResult.integrations && (bookingResult.integrations.calendar === 'failed' || bookingResult.integrations.email === 'failed') && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-amber-800 font-medium">Your booking is confirmed, but:</p>
                      <ul className="text-amber-700 text-sm mt-1 space-y-1">
                        {bookingResult.integrations.calendar === 'failed' && (
                          <li>• Calendar invite could not be sent. Please add this event manually below.</li>
                        )}
                        {bookingResult.integrations.email === 'failed' && (
                          <li>• Confirmation email could not be sent. Please save this page.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Session details card */}
              <div className="border border-gray-200 rounded-xl p-5 mb-5">
                <div className="flex items-center gap-2 text-[#667085] text-sm mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatInTimeZone(parseISO(bookingResult.slot.start_time), timezone, 'EEEE, MMMM d')}
                </div>
                <div className="text-2xl font-semibold text-[#101E57] mb-1">
                  {formatInTimeZone(parseISO(bookingResult.slot.start_time), timezone, 'h:mm a')}
                  <span className="text-[#667085] font-normal"> – </span>
                  {formatInTimeZone(parseISO(bookingResult.slot.end_time), timezone, 'h:mm a')}
                </div>
                <div className="text-sm text-[#667085] mb-3">{timezone.replace(/_/g, ' ')}</div>
                <div className="text-[#101E57] font-medium text-lg">{bookingResult.event.name}</div>
              </div>

              {/* Add to Calendar - PRIORITIZED, central position */}
              {!isWaitlisted && (
                <div className="bg-[#F6F6F9] rounded-xl p-5 mb-5">
                  <h3 className="font-medium text-[#101E57] mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Add to your calendar
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <a
                      href={googleCalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-gray-200 hover:border-[#6F71EE] hover:bg-[#6F71EE]/5 transition min-h-[80px]"
                    >
                      <svg className="w-6 h-6 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm-2.25 6.75h-4.5v4.5h4.5v-4.5z"/>
                      </svg>
                      <span className="text-sm font-medium text-[#101E57]">Google</span>
                    </a>
                    <a
                      href={outlookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-gray-200 hover:border-[#6F71EE] hover:bg-[#6F71EE]/5 transition min-h-[80px]"
                    >
                      <svg className="w-6 h-6 text-[#0078D4]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21.75 5.25h-7.5v13.5h7.5a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75zM2.25 6v12a.75.75 0 00.75.75h7.5V5.25H3a.75.75 0 00-.75.75z"/>
                      </svg>
                      <span className="text-sm font-medium text-[#101E57]">Outlook</span>
                    </a>
                    {bookingResult.manage_token && (
                      <a
                        href={`/api/manage/${bookingResult.manage_token}/ical`}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-gray-200 hover:border-[#6F71EE] hover:bg-[#6F71EE]/5 transition min-h-[80px]"
                      >
                        <svg className="w-6 h-6 text-[#101E57]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium text-[#101E57]">Apple (.ics)</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Meeting Link - Copy Link primary, Join secondary (since meeting is future) */}
              {!isWaitlisted && bookingResult.slot.google_meet_link && (
                <div className="mb-5">
                  <h3 className="font-medium text-[#101E57] mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Meeting link
                  </h3>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCopyMeetLink}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#6F71EE] text-white py-4 rounded-lg hover:bg-[#5a5cd0] transition font-medium text-base min-h-[52px]"
                    >
                      {linkCopied ? (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Meeting Link
                        </>
                      )}
                    </button>
                    <a
                      href={bookingResult.slot.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-6 py-4 border-2 border-gray-200 text-[#101E57] rounded-lg hover:bg-gray-50 hover:border-gray-300 transition font-medium min-h-[52px]"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Join Now
                    </a>
                  </div>
                  <p className="text-xs text-[#667085] mt-2 text-center">
                    Save this link—you&apos;ll need it on {formatInTimeZone(parseISO(bookingResult.slot.start_time), timezone, 'EEEE')}
                  </p>
                </div>
              )}

              {/* Next step - what to expect */}
              <div className="bg-[#417762]/5 border border-[#417762]/20 rounded-xl p-5 mb-5">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 ${isWaitlisted ? 'bg-amber-100 text-amber-600' : 'bg-[#417762]/10 text-[#417762]'} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-[#101E57]">
                      {isWaitlisted ? 'Check your email' : 'Accept the calendar invite'}
                    </p>
                    <p className="text-sm text-[#667085] mt-1">
                      {isWaitlisted
                        ? "We sent a confirmation. You'll hear from us if a spot opens."
                        : "Check your inbox—the calendar invite should arrive within a few minutes."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Prep Materials - only show for confirmed bookings */}
              {event?.prep_materials && !isWaitlisted && (
                <div className="bg-[#6F71EE]/5 border border-[#6F71EE]/20 rounded-xl p-5 mb-5">
                  <h3 className="font-medium text-[#101E57] mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Before your session
                  </h3>
                  <div className="text-[#667085] text-sm whitespace-pre-wrap leading-relaxed">
                    {event.prep_materials}
                  </div>
                </div>
              )}

              {/* Waitlist manage link */}
              {isWaitlisted && bookingResult.manage_token && (
                <div className="text-center pt-4 border-t border-gray-100">
                  <a
                    href={`/manage/${bookingResult.manage_token}`}
                    className="inline-flex items-center gap-1 text-[#667085] hover:text-[#101E57] text-sm"
                  >
                    Leave waitlist
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <Image
              src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
              alt="LiveSchool"
              width={100}
              height={26}
              className="mx-auto opacity-50"
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
        <div className="mx-auto max-w-[650px]">
          <button
            onClick={() => setSelectedSlot(null)}
            className="text-[#6F71EE] hover:text-[#5a5cd0] mb-4 flex items-center gap-1 font-medium"
          >
            ← Back to times
          </button>

          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Softer header - reassuring, not formal */}
            <div className="bg-gradient-to-br from-[#1a2a6c] to-[#2d3a7c] text-white p-5">
              <div className="flex items-center justify-between mb-3">
                <Image
                  src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
                  alt="LiveSchool"
                  width={90}
                  height={24}
                  className="brightness-0 invert opacity-80"
                />
                <span className="text-white/60 text-sm">{event.duration_minutes} min</span>
              </div>
              <h1 className="text-lg font-medium" style={{ color: 'white' }}>{event.name}</h1>
              <div className="flex items-center gap-2 mt-1 text-white/70 text-sm">
                {event.host_profile_image ? (
                  <img
                    src={event.host_profile_image}
                    alt={event.host_name}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : null}
                <span>with {event.host_name}</span>
              </div>
            </div>

            {/* Selected time - the hero of this screen */}
            <div className="p-5 border-b border-gray-100 bg-white">
              <p className="text-xl font-semibold text-[#101E57]">
                {formatInTimeZone(
                  parseISO(selectedSlot.start_time),
                  timezone,
                  'EEEE, MMMM d'
                )}
              </p>
              <p className="text-lg text-[#101E57] mt-0.5">
                {formatInTimeZone(
                  parseISO(selectedSlot.start_time),
                  timezone,
                  'h:mm a'
                )}
                {' – '}
                {formatInTimeZone(
                  parseISO(selectedSlot.end_time),
                  timezone,
                  'h:mm a'
                )}
              </p>
              <p className="text-sm text-[#98A2B3] mt-1">{timezone.replace(/_/g, ' ')}</p>
            </div>

            {/* Form - organized by intent, not by field type */}
            <form onSubmit={handleBooking} className="p-5">
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              {/* Group 1: Essentials - who you are */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-[#667085] mb-1">
                      First name
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
                      onFocus={() => {
                        if (!formStartedRef.current) {
                          formStartedRef.current = true;
                          analytics.trackFormStart();
                        }
                      }}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#667085] mb-1">
                      Last name
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
                      onFocus={() => {
                        if (!formStartedRef.current) {
                          formStartedRef.current = true;
                          analytics.trackFormStart();
                        }
                      }}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[#667085] mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, email: e.target.value }));
                        setEmailError(null);
                        setContactLookupDone(false);
                      }}
                      onBlur={handleEmailBlur}
                      className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] ${
                        emailError ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                    />
                    {emailValidating && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-[#6F71EE] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {emailError && (
                    <p className="text-xs text-red-600 mt-1">{emailError}</p>
                  )}
                </div>

              </div>

              {/* Group 2: Optional / helpful - with subtle visual break */}
              <div className="mt-6 pt-5 border-t border-gray-100 space-y-4">
                {/* Phone Number - friendlier framing */}
                {(event.phone_required || event.sms_reminders_enabled) && (
                  <div>
                    <label className="block text-sm text-[#667085] mb-1">
                      Phone number
                      {!(event.phone_required || event.sms_phone_required) && (
                        <span className="text-[#98A2B3] ml-1">(only if we have trouble connecting)</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required={event.phone_required || event.sms_phone_required}
                        value={formData.phone}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, phone: e.target.value }));
                          setPhonePrefilled(false);
                        }}
                        placeholder="+1 (555) 123-4567"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                      />
                      {phonePrefilled && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <span className="text-xs text-[#417762] bg-green-50 px-2 py-1 rounded font-medium">
                            Found
                          </span>
                        </div>
                      )}
                    </div>
                    {event.sms_reminders_enabled && (
                      <p className="text-xs text-[#98A2B3] mt-1">
                        We can send you a reminder before your session
                      </p>
                    )}

                    {/* SMS Consent - only show if SMS enabled AND phone is provided */}
                    {event.sms_reminders_enabled && formData.phone && (
                      <label className="flex items-start gap-2 cursor-pointer mt-2">
                        <input
                          type="checkbox"
                          checked={formData.sms_consent}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, sms_consent: e.target.checked }))
                          }
                          className="mt-0.5 w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
                        />
                        <span className="text-xs text-[#667085]">
                          Send me an SMS reminder. Standard rates may apply.
                        </span>
                      </label>
                    )}
                  </div>
                )}

                {/* Guest Emails - conversational, not system-y */}
                <div>
                  <label className="block text-sm text-[#667085] mb-1">
                    Want to invite a colleague?
                  </label>
                  <p className="text-xs text-[#98A2B3] mb-2">
                    They&apos;ll receive the calendar invite and meeting link.
                  </p>

                  {/* Added guests list */}
                  {guestEmails.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {guestEmails.map((guestEmail) => (
                        <div
                          key={guestEmail}
                          className="flex items-center justify-between bg-[#F6F6F9] px-3 py-2 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-[#6F71EE]/10 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <span className="text-sm text-[#101E57]">{guestEmail}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveGuestEmail(guestEmail)}
                            className="text-[#667085] hover:text-red-500 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add guest input */}
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={guestEmailInput}
                      onChange={(e) => {
                        setGuestEmailInput(e.target.value);
                        setGuestEmailError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddGuestEmail();
                        }
                      }}
                      placeholder="colleague@school.edu"
                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] ${
                        guestEmailError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleAddGuestEmail}
                      className="px-4 py-2 bg-[#6F71EE]/10 text-[#6F71EE] rounded-lg hover:bg-[#6F71EE]/20 transition font-medium"
                    >
                      Add
                    </button>
                  </div>
                  {guestEmailError && (
                    <p className="text-xs text-red-600 mt-1">{guestEmailError}</p>
                  )}
                </div>

                {/* Custom Questions - softer styling */}
                {event.custom_questions && event.custom_questions.length > 0 && (
                  <div className="space-y-3">
                    {event.custom_questions.map((q: CustomQuestion) => (
                      <div key={q.id}>
                        <label className="block text-sm text-[#667085] mb-1">
                          {q.question}
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
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                          />
                        )}
                        {q.type === 'textarea' && (
                          <textarea
                            required={q.required}
                            rows={2}
                            value={questionResponses[q.id] || ''}
                            onChange={(e) =>
                              setQuestionResponses((prev) => ({
                                ...prev,
                                [q.id]: e.target.value,
                              }))
                            }
                            placeholder="Optional - share anything that would help us prepare"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] placeholder:text-[#C0C5D0]"
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
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
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

              {/* What happens next - tighter, checkmark format */}
              <div className="mt-5 mb-4 text-sm text-[#667085]">
                <p className="font-medium text-[#101E57] mb-2">What happens next</p>
                <div className="space-y-1.5">
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#417762] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Calendar invite sent instantly
                  </p>
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#417762] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Google Meet link included
                  </p>
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#417762] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Reschedule anytime if plans change
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={booking}
                className="w-full bg-[#6F71EE] text-white py-3.5 rounded-xl hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium text-base shadow-sm"
              >
                {booking ? 'Booking...' : 'Confirm Booking'}
              </button>

              <p className="text-xs text-[#98A2B3] mt-3 text-center">
                No commitment. Reschedule anytime if plans change.
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Progressive disclosure - scroll-free first screen
  const MIN_SLOTS_TO_SHOW = 2; // Always show at least 2 slots
  const MAX_INITIAL_SLOTS = 5; // Cap slots to prevent scrolling
  const DAYS_PER_EXPAND = 3; // Show 3 more days each expansion
  const sortedDates = Object.keys(groupedSlots).sort();

  // Calculate how many days needed to show at least MIN_SLOTS_TO_SHOW
  const calculateInitialDays = () => {
    let totalSlots = 0;
    let daysNeeded = 0;
    for (const date of sortedDates) {
      daysNeeded++;
      const dateSlots = groupedSlots[date];
      // For one-on-one, only count available slots
      const availableCount = event.meeting_type === 'one_on_one'
        ? dateSlots.filter(s => s.booking_count === 0).length
        : dateSlots.length;
      totalSlots += availableCount;
      if (totalSlots >= MIN_SLOTS_TO_SHOW) break;
    }
    return Math.max(1, daysNeeded); // At least 1 day
  };

  // If user selected a specific date, show that date
  // Otherwise use progressive disclosure
  let visibleDates: string[];
  let hasMoreDates: boolean;
  let remainingDates: number;
  let isFirstView: boolean;

  if (selectedDate && sortedDates.includes(selectedDate)) {
    // User picked a specific date - show just that date
    visibleDates = [selectedDate];
    hasMoreDates = sortedDates.length > 1;
    remainingDates = sortedDates.length - 1;
    isFirstView = false; // Show all slots for selected date
  } else {
    // Default progressive disclosure - show enough days to have at least MIN_SLOTS_TO_SHOW
    const initialDays = visibleWeeks === 1 ? calculateInitialDays() : 1;
    const totalVisibleDays = initialDays + (visibleWeeks - 1) * DAYS_PER_EXPAND;
    visibleDates = sortedDates.slice(0, totalVisibleDays);
    hasMoreDates = sortedDates.length > visibleDates.length;
    remainingDates = sortedDates.length - visibleDates.length;
    isFirstView = visibleWeeks === 1 && !selectedDate;
  }

  // Available dates set for the date picker
  const availableDatesSet = new Set(sortedDates);

  // Timezone display helper - get short label
  const getTimezoneLabel = (tz: string) => {
    const found = TIMEZONE_OPTIONS.flatMap(g => g.zones).find(z => z.value === tz);
    return found?.label || tz.replace(/_/g, ' ');
  };

  // Check if this is a webinar (uses different layout)
  const isWebinar = event.meeting_type === 'webinar';

  // Main slot selection screen - designed to fit in one viewport
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F6F6F9] to-[#EEEEF4] py-6 px-4">
      <div className="mx-auto max-w-[650px]">
        {/* Card with subtle brand accent */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          {/* Brand accent line */}
          <div className="h-0.5 bg-gradient-to-r from-[#6F71EE] to-[#417762]" />

          {/* Banner Image (both layouts) */}
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

          {/* NON-WEBINAR: Compact Hero Section */}
          {!isWebinar && (
            <div className="p-5">
              {/* Logo + Title row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h1 className="text-lg font-semibold text-[#101E57] leading-tight">{event.name}</h1>
                  {/* Host always visible */}
                  <p className="text-sm text-[#667085] mt-1">
                    {event.meeting_type === 'round_robin' ? 'with LiveSchool Team' :
                     event.meeting_type === 'collective' ? 'with LiveSchool Team' :
                     `with ${event.host_name}`} · {event.duration_minutes} min
                  </p>
                </div>
                <Image
                  src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
                  alt="LiveSchool"
                  width={80}
                  height={20}
                  className="opacity-60 flex-shrink-0"
                />
              </div>

              {/* Description - collapsible on first view for space */}
              {event.description && (
                <div
                  className="text-sm text-[#667085] leading-relaxed [&_a]:text-[#6F71EE] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1"
                  dangerouslySetInnerHTML={{ __html: event.description }}
                />
              )}
            </div>
          )}

          {/* Time slots / Scheduling section */}
          <div className="pt-6 pb-5 px-5 bg-[#FAFAFC] border-t border-gray-100">
            {/* Section header - feels like "now let's do this" */}
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-[#101E57] mb-1">Choose a time</h2>
              {/* Timezone as human-readable inline text */}
              <p className="text-sm text-[#667085]">
                Times shown in{' '}
                <button
                  onClick={() => setShowTimezoneDropdown(!showTimezoneDropdown)}
                  className="text-[#6F71EE] hover:underline inline-flex items-center gap-0.5"
                >
                  {getTimezoneLabel(timezone)}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </p>
              <div className="relative">
                {showTimezoneDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto w-64">
                    {detectedTimezone && !isDetectedInList && (
                      <div className="p-2 border-b border-gray-100">
                        <p className="text-xs text-[#667085] px-2 mb-1">Your timezone</p>
                        <button
                          onClick={() => { setTimezone(detectedTimezone); setShowTimezoneDropdown(false); }}
                          className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-[#6F71EE]/5 ${timezone === detectedTimezone ? 'bg-[#6F71EE]/10 text-[#6F71EE]' : 'text-[#101E57]'}`}
                        >
                          {detectedTimezone.replace(/_/g, ' ')}
                        </button>
                      </div>
                    )}
                    {TIMEZONE_OPTIONS.map((group) => (
                      <div key={group.group} className="p-2 border-b border-gray-100 last:border-0">
                        <p className="text-xs text-[#667085] px-2 mb-1">{group.group}</p>
                        {group.zones.map((tz) => (
                          <button
                            key={tz.value}
                            onClick={() => { setTimezone(tz.value); setShowTimezoneDropdown(false); }}
                            className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-[#6F71EE]/5 ${timezone === tz.value ? 'bg-[#6F71EE]/10 text-[#6F71EE]' : 'text-[#101E57]'}`}
                          >
                            {tz.label}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Attendee calendar overlay - connect Outlook/Microsoft 365 */}
            {Object.keys(groupedSlots).length > 0 && (
              <AttendeeCalendarConnect
                startDate={slots[0]?.start_time || new Date().toISOString()}
                endDate={slots[slots.length - 1]?.end_time || new Date().toISOString()}
                onBusyTimesChange={setAttendeeBusyTimes}
              />
            )}

            {Object.keys(groupedSlots).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#667085]">
                  No available times at the moment. Please check back later.
                </p>
                {isAdmin && event && (
                  <button
                    onClick={() => setShowTroubleshoot(true)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#6F71EE] border border-[#6F71EE] rounded-lg hover:bg-[#6F71EE]/5 transition"
                  >
                    Troubleshoot Availability
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {visibleDates.map((date, dateIndex) => {
                  const dateSlots = groupedSlots[date];
                  const isOneOnOne = event.meeting_type === 'one_on_one';

                  // Filter available slots
                  let availableSlots = isOneOnOne
                    ? dateSlots.filter(s => s.booking_count === 0)
                    : dateSlots;

                  // On first view, cap total slots shown to keep it scroll-free
                  let hiddenSlotCount = 0;
                  if (isFirstView && dateIndex === 0 && availableSlots.length > MAX_INITIAL_SLOTS) {
                    hiddenSlotCount = availableSlots.length - MAX_INITIAL_SLOTS;
                    availableSlots = availableSlots.slice(0, MAX_INITIAL_SLOTS);
                  }

                  if (availableSlots.length === 0) return null;

                  // Render a single slot button
                  const renderSlotButton = (slot: SlotWithCount, slotIndex: number) => {
                    const isFull = slot.booking_count >= event.max_attendees;
                    const isFirstSlot = dateIndex === 0 && slotIndex === 0;

                    // Check if slot conflicts with attendee's calendar
                    const hasConflict = attendeeBusyTimes.length > 0 && attendeeBusyTimes.some(busy =>
                      areIntervalsOverlapping(
                        { start: parseISO(slot.start_time), end: parseISO(slot.end_time) },
                        { start: parseISO(busy.start), end: parseISO(busy.end) }
                      )
                    );

                    return (
                      <button
                        key={slot.id}
                        onClick={() => {
                          if (!isFull) {
                            analytics.trackSlotSelection(slot.id, slot.start_time);
                            setSelectedSlot(slot);
                          }
                        }}
                        disabled={isFull}
                        title={hasConflict ? 'You have a calendar conflict at this time' : undefined}
                        className={`relative px-3 py-2 rounded-lg border transition-all duration-200 text-center ${
                          isFull
                            ? 'bg-gray-50 text-[#98A2B3] cursor-not-allowed border-gray-100'
                            : hasConflict
                            ? 'border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100 hover:border-amber-300'
                            : isFirstSlot
                            ? 'border-[#6F71EE]/30 text-[#101E57] bg-[#6F71EE]/5 hover:border-[#6F71EE] hover:bg-[#6F71EE]/10 hover:shadow-sm active:bg-[#6F71EE] active:text-white'
                            : 'border-gray-150 text-[#101E57] bg-white hover:border-[#6F71EE]/50 hover:bg-[#6F71EE]/5 hover:shadow-sm active:bg-[#6F71EE] active:text-white'
                        }`}
                      >
                        {isFirstSlot && !isFull && !hasConflict && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-medium text-[#6F71EE] bg-white px-1.5 rounded-full border border-[#6F71EE]/20">
                            Next
                          </span>
                        )}
                        <span className="block text-sm font-medium leading-tight">{formatInTimeZone(parseISO(slot.start_time), timezone, 'h:mm')}</span>
                        <span className="block text-xs opacity-70">{formatInTimeZone(parseISO(slot.start_time), timezone, 'a')}</span>
                      </button>
                    );
                  };

                  return (
                    <div key={date}>
                      {/* Date header - compact on first view */}
                      <p className="text-sm text-[#667085] mb-3">
                        {formatInTimeZone(parseISO(dateSlots[0].start_time), timezone, 'EEEE, MMMM d')}
                      </p>

                      {/* Flat grid of times - no morning/afternoon labels on first view */}
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {availableSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                      </div>

                      {/* Show more times for this day */}
                      {hiddenSlotCount > 0 && (
                        <button
                          onClick={() => setVisibleWeeks(2)}
                          className="mt-3 text-sm text-[#6F71EE] hover:underline"
                        >
                          + {hiddenSlotCount} more times
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Actions: More dates + Pick specific date */}
                <div className="flex items-center justify-between pt-4">
                  {/* Show more dates */}
                  {hasMoreDates ? (
                    <button
                      onClick={() => {
                        setSelectedDate(null);
                        setVisibleWeeks(prev => prev + 1);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#6F71EE] bg-[#6F71EE]/10 rounded-lg hover:bg-[#6F71EE]/20 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Show more days ({remainingDates} more)
                    </button>
                  ) : (
                    <span />
                  )}

                  {/* Pick a specific date */}
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="text-sm text-[#6F71EE] hover:underline flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {selectedDate ? 'Change date' : 'Pick a date'}
                  </button>
                </div>

                {/* Date picker calendar - muted utility, not a destination */}
                {showDatePicker && (
                  <div className="mt-3 p-3 bg-[#FAFAFC] rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-[#667085]">Jump to a date</p>
                      {selectedDate && (
                        <button
                          onClick={() => {
                            setSelectedDate(null);
                            setShowDatePicker(false);
                            setVisibleWeeks(1);
                          }}
                          className="text-xs text-[#98A2B3] hover:text-[#6F71EE]"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-7 gap-0.5">
                      {/* Day headers */}
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                        <div key={`${day}-${i}`} className="text-[10px] text-[#C0C5D0] text-center py-0.5">
                          {day}
                        </div>
                      ))}
                      {/* Calendar days - show 5 weeks starting from today */}
                      {(() => {
                        const today = new Date();
                        const startOfWeek = new Date(today);
                        startOfWeek.setDate(today.getDate() - today.getDay());

                        const days = [];
                        for (let i = 0; i < 35; i++) {
                          const date = new Date(startOfWeek);
                          date.setDate(startOfWeek.getDate() + i);
                          const dateStr = format(date, 'yyyy-MM-dd');
                          const isAvailable = availableDatesSet.has(dateStr);
                          const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                          const isSelected = selectedDate === dateStr;
                          const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

                          days.push(
                            <button
                              key={dateStr}
                              onClick={() => {
                                if (isAvailable && !isPast) {
                                  setSelectedDate(dateStr);
                                  setShowDatePicker(false);
                                }
                              }}
                              disabled={!isAvailable || isPast}
                              className={`
                                text-xs py-1 rounded transition
                                ${isSelected
                                  ? 'bg-[#6F71EE] text-white'
                                  : isAvailable && !isPast
                                  ? 'text-[#667085] hover:bg-white hover:text-[#101E57]'
                                  : 'text-[#E0E0E0] cursor-not-allowed'
                                }
                                ${isToday && !isSelected ? 'ring-1 ring-[#6F71EE]/30' : ''}
                              `}
                            >
                              {date.getDate()}
                            </button>
                          );
                        }
                        return days;
                      })()}
                    </div>
                  </div>
                )}

                {/* Confidence cue - reassurance at the moment it matters */}
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-[#667085]">
                    <div className="w-5 h-5 bg-[#417762]/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-[#417762]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Calendar invite with Google Meet link sent instantly</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* WEBINAR: Description section (after slots) */}
          {isWebinar && event.description && (
            <div className="p-6 border-t">
              <div
                className="prose prose-sm max-w-none text-[#667085] [&_a]:text-[#6F71EE] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1 [&_p]:my-2 [&_strong]:text-[#101E57] [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </div>
          )}

          {/* WEBINAR: Title and Event Details (after description) */}
          {isWebinar && (
            <div className="p-6 border-t">
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
                <span className="flex items-center gap-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {event.max_attendees > 1 ? `Up to ${event.max_attendees} attendees` : 'Webinar'}
                </span>
              </div>

              {/* Booking Rules Info for webinars */}
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
          )}

        </div>
      </div>

      {/* Troubleshoot Modal - Admin only */}
      {event && (
        <TroubleshootModal
          eventId={event.id}
          isOpen={showTroubleshoot}
          onClose={() => setShowTroubleshoot(false)}
        />
      )}
    </div>
  );
}
