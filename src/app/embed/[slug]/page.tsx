'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { OHEvent, OHSlot, CustomQuestion } from '@/types';
import { decodeResponses } from '@/lib/routing';

interface SlotWithCount extends OHSlot {
  booking_count: number;
}

interface GroupedSlots {
  [date: string]: SlotWithCount[];
}

// Common timezones
const TIMEZONE_OPTIONS = [
  { group: 'North America', zones: [
    { value: 'America/New_York', label: 'Eastern (ET)' },
    { value: 'America/Chicago', label: 'Central (CT)' },
    { value: 'America/Denver', label: 'Mountain (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  ]},
  { group: 'Europe', zones: [
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
  ]},
  { group: 'Asia & Pacific', zones: [
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  ]},
];

export default function EmbedBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const searchParams = useSearchParams();

  // Embed options from URL params
  const parentOrigin = searchParams.get('parentOrigin') || '*';
  const hideHeader = searchParams.get('hideHeader') === 'true';
  const hideBranding = searchParams.get('hideBranding') === 'true';
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
  });
  const [questionResponses, setQuestionResponses] = useState<Record<string, string>>({});
  const [booking, setBooking] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    id: string;
    event: OHEvent;
    slot: { start_time: string; end_time: string; google_meet_link: string | null };
    manage_token?: string;
  } | null>(null);

  // Timezone
  const [timezone, setTimezone] = useState('America/New_York');

  // Post message to parent
  const postToParent = useCallback((type: string, data?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type, ...data }, parentOrigin);
    }
  }, [parentOrigin]);

  // Send height updates to parent for auto-resize
  useEffect(() => {
    const sendHeight = () => {
      postToParent('liveschool:resize', { height: document.body.scrollHeight });
    };

    sendHeight();
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);

    return () => observer.disconnect();
  }, [postToParent, selectedSlot, bookingComplete, loading]);

  useEffect(() => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(userTimezone);
  }, []);

  useEffect(() => {
    fetchEventAndSlots();
  }, [slug]);

  // Prefill from routing form
  useEffect(() => {
    if (event && prefillParam) {
      const prefillData = decodeResponses(prefillParam);
      if (prefillData) {
        const customQuestions = event.custom_questions || [];
        const initialResponses: Record<string, string> = {};
        customQuestions.forEach((q) => {
          if (prefillData[q.id]) {
            initialResponses[q.id] = prefillData[q.id];
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
      const eventsRes = await fetch('/api/events');
      if (!eventsRes.ok) throw new Error('Failed to load events');

      const events = await eventsRes.json();
      const foundEvent = events.find((e: OHEvent) => e.slug === slug);

      if (!foundEvent) {
        throw new Error('Event not found');
      }

      setEvent(foundEvent);

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

      // Notify parent of successful booking
      postToParent('liveschool:bookingComplete', {
        data: {
          bookingId: data.id,
          eventName: event.name,
          slotTime: selectedSlot.start_time,
          attendeeEmail: formData.email,
        },
      });
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

  // Styles
  const styles = {
    container: { fontFamily: 'Poppins, sans-serif', padding: '16px', maxWidth: '100%' },
    card: { background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' },
    header: { padding: '16px', borderBottom: '1px solid #eee' },
    title: { fontSize: '18px', fontWeight: 600, color: '#101E57', margin: 0 },
    subtitle: { fontSize: '14px', color: '#667085', marginTop: '4px' },
    meta: { fontSize: '13px', color: '#667085', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' },
    btn: { background: '#6F71EE', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, width: '100%' },
    btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
    input: { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' as const },
    label: { display: 'block', fontSize: '13px', fontWeight: 500, color: '#101E57', marginBottom: '4px' },
    slotBtn: { padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: '#fff', width: '100%', textAlign: 'left' as const },
    slotBtnHover: { borderColor: '#6F71EE', background: '#6F71EE10' },
    error: { background: '#FEE2E2', color: '#DC2626', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' },
    success: { background: '#417762', color: '#fff', padding: '20px', textAlign: 'center' as const },
  };

  if (loading) {
    return (
      <div style={{ ...styles.container, textAlign: 'center', padding: '40px', color: '#667085' }}>
        Loading...
      </div>
    );
  }

  if (error && !event) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, padding: '20px', textAlign: 'center' }}>
          <p style={{ color: '#DC2626' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  // Booking complete screen
  if (bookingComplete && bookingResult) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.success}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>&#10003;</div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>You&apos;re all set, {formData.first_name}!</h2>
            <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '14px' }}>We&apos;re looking forward to meeting with you</p>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ background: '#F6F6F9', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
              <p style={{ margin: 0, fontWeight: 500, color: '#101E57' }}>{bookingResult.event.name}</p>
              <p style={{ margin: '4px 0 0', color: '#667085', fontSize: '13px' }}>
                {formatInTimeZone(parseISO(bookingResult.slot.start_time), timezone, 'EEEE, MMMM d, yyyy')}
              </p>
              <p style={{ margin: '2px 0 0', fontWeight: 500, color: '#101E57', fontSize: '14px' }}>
                {formatInTimeZone(parseISO(bookingResult.slot.start_time), timezone, 'h:mm a')} - {formatInTimeZone(parseISO(bookingResult.slot.end_time), timezone, 'h:mm a')}
              </p>
            </div>
            {bookingResult.slot.google_meet_link && (
              <a
                href={bookingResult.slot.google_meet_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...styles.btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}
              >
                Join Google Meet
              </a>
            )}
            <p style={{ fontSize: '12px', color: '#667085', textAlign: 'center', marginTop: '12px' }}>
              Check your email for calendar invite and details
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Booking form screen
  if (selectedSlot) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          {!hideHeader && (
            <div style={{ background: '#101E57', color: '#fff', padding: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '16px' }}>{event.name}</h2>
              <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '13px' }}>{event.duration_minutes} min · {event.host_name}</p>
            </div>
          )}
          <div style={{ background: '#F6F6F9', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
            <p style={{ margin: 0, fontWeight: 500, color: '#101E57', fontSize: '14px' }}>
              {formatInTimeZone(parseISO(selectedSlot.start_time), timezone, 'EEEE, MMMM d')}
            </p>
            <p style={{ margin: '2px 0 0', color: '#667085', fontSize: '13px' }}>
              {formatInTimeZone(parseISO(selectedSlot.start_time), timezone, 'h:mm a')} - {formatInTimeZone(parseISO(selectedSlot.end_time), timezone, 'h:mm a')}
            </p>
          </div>
          <form onSubmit={handleBooking} style={{ padding: '16px' }}>
            {error && <div style={styles.error}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={styles.label}>First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                  style={styles.input}
                />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={styles.label}>Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                style={styles.input}
              />
            </div>
            {event.custom_questions && event.custom_questions.length > 0 && (
              <div style={{ borderTop: '1px solid #eee', paddingTop: '12px', marginBottom: '12px' }}>
                {event.custom_questions.map((q: CustomQuestion) => (
                  <div key={q.id} style={{ marginBottom: '12px' }}>
                    <label style={styles.label}>{q.question} {q.required && '*'}</label>
                    {q.type === 'select' && q.options ? (
                      <select
                        required={q.required}
                        value={questionResponses[q.id] || ''}
                        onChange={(e) => setQuestionResponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        style={styles.input}
                      >
                        <option value="">Select an option</option>
                        {q.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : q.type === 'textarea' ? (
                      <textarea
                        required={q.required}
                        rows={3}
                        value={questionResponses[q.id] || ''}
                        onChange={(e) => setQuestionResponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        style={styles.input}
                      />
                    ) : q.type === 'phone' ? (
                      <input
                        type="tel"
                        required={q.required}
                        placeholder="(555) 123-4567"
                        value={questionResponses[q.id] || ''}
                        onChange={(e) => setQuestionResponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        style={styles.input}
                      />
                    ) : q.type === 'radio' && q.options ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {q.options.map((opt) => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name={`question-${q.id}`}
                              value={opt}
                              checked={questionResponses[q.id] === opt}
                              onChange={(e) => setQuestionResponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
                              style={{ width: '16px', height: '16px' }}
                            />
                            <span style={{ fontSize: '14px', color: '#101E57' }}>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : q.type === 'checkbox' && q.options ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {q.options.map((opt) => {
                          const currentValues = questionResponses[q.id] ? questionResponses[q.id].split(', ') : [];
                          const isChecked = currentValues.includes(opt);
                          return (
                            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                value={opt}
                                checked={isChecked}
                                onChange={(e) => {
                                  const newValues = e.target.checked
                                    ? [...currentValues, opt]
                                    : currentValues.filter((v) => v !== opt);
                                  setQuestionResponses((prev) => ({
                                    ...prev,
                                    [q.id]: newValues.join(', '),
                                  }));
                                }}
                                style={{ width: '16px', height: '16px' }}
                              />
                              <span style={{ fontSize: '14px', color: '#101E57' }}>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        type="text"
                        required={q.required}
                        value={questionResponses[q.id] || ''}
                        onChange={(e) => setQuestionResponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        style={styles.input}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                style={{ ...styles.btn, background: '#fff', color: '#667085', border: '1px solid #ddd', flex: '0 0 auto', width: 'auto', padding: '10px 16px' }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={booking}
                style={{ ...styles.btn, flex: 1, ...(booking ? styles.btnDisabled : {}) }}
              >
                {booking ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Slot selection screen
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {!hideHeader && (
          <div style={styles.header}>
            <h1 style={styles.title}>{event.name}</h1>
            {event.subtitle && <p style={styles.subtitle}>{event.subtitle}</p>}
            <div style={styles.meta}>
              <span>{event.duration_minutes} min</span>
              <span>·</span>
              <span>{event.host_name}</span>
            </div>
          </div>
        )}
        <div style={{ padding: '16px' }}>
          {/* Timezone selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ ...styles.label, marginBottom: '6px' }}>Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{ ...styles.input, width: '100%' }}
            >
              {TIMEZONE_OPTIONS.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.zones.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Slots */}
          {Object.keys(groupedSlots).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#667085' }}>
              No available times at the moment
            </div>
          ) : (
            <div>
              {Object.entries(groupedSlots).map(([date, daySlots]) => (
                <div key={date} style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#101E57', marginBottom: '8px' }}>
                    {format(parseISO(date), 'EEEE, MMMM d')}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
                    {daySlots.map((slot) => {
                      const isFull = slot.booking_count >= (event?.max_attendees || 1);
                      const spotsLeft = (event?.max_attendees || 1) - slot.booking_count;

                      if (event?.max_attendees === 1 && isFull) return null;

                      return (
                        <button
                          key={slot.id}
                          onClick={() => !isFull && setSelectedSlot(slot)}
                          disabled={isFull}
                          style={{
                            ...styles.slotBtn,
                            ...(isFull ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>
                            {formatInTimeZone(parseISO(slot.start_time), timezone, 'h:mm a')}
                          </span>
                          {event?.max_attendees > 1 && !isFull && (
                            <span style={{ display: 'block', fontSize: '11px', color: '#667085' }}>
                              {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {!hideBranding && (
          <div style={{ padding: '12px', borderTop: '1px solid #eee', textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: '#999' }}>Powered by LiveSchool Connect</span>
          </div>
        )}
      </div>
    </div>
  );
}
