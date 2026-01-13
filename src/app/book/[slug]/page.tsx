'use client';

import { useState, useEffect, use } from 'react';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { OHEvent, OHSlot } from '@/types';

interface SlotWithCount extends OHSlot {
  booking_count: number;
}

interface GroupedSlots {
  [date: string]: SlotWithCount[];
}

export default function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
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
  const [booking, setBooking] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    event: OHEvent;
    slot: { start_time: string; end_time: string; google_meet_link: string | null };
  } | null>(null);

  // Timezone
  const [timezone, setTimezone] = useState('America/New_York');

  useEffect(() => {
    // Detect user's timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(userTimezone);
  }, []);

  useEffect(() => {
    fetchEventAndSlots();
  }, [slug]);

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
    if (!selectedSlot) return;

    setBooking(true);
    setError('');

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          ...formData,
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-gray-500">
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
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
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

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              You&apos;re booked!
            </h1>

            <p className="text-gray-600 mb-6">
              A confirmation email and calendar invitation have been sent to{' '}
              <strong>{formData.email}</strong>
            </p>

            <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
              <h2 className="font-semibold text-gray-900 mb-2">
                {bookingResult.event.name}
              </h2>
              <p className="text-gray-600">
                {formatInTimeZone(
                  parseISO(bookingResult.slot.start_time),
                  timezone,
                  'EEEE, MMMM d, yyyy'
                )}
              </p>
              <p className="text-gray-600">
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
              <p className="text-gray-500 text-sm mt-1">{timezone}</p>

              {bookingResult.slot.google_meet_link && (
                <a
                  href={bookingResult.slot.google_meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 text-blue-600 hover:text-blue-700"
                >
                  Join Google Meet →
                </a>
              )}
            </div>

            <p className="text-sm text-gray-500">
              Need to make changes? Reply to your confirmation email.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Booking form screen
  if (selectedSlot) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => setSelectedSlot(null)}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-1"
          >
            ← Back to times
          </button>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-blue-600 text-white p-6">
              <h1 className="text-xl font-bold">{event.name}</h1>
              <p className="text-blue-100 mt-1">
                {event.duration_minutes} min · {event.host_name}
              </p>
            </div>

            {/* Selected time */}
            <div className="p-6 border-b bg-gray-50">
              <p className="font-medium text-gray-900">
                {formatInTimeZone(
                  parseISO(selectedSlot.start_time),
                  timezone,
                  'EEEE, MMMM d, yyyy'
                )}
              </p>
              <p className="text-gray-600">
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
              <p className="text-gray-500 text-sm mt-1">{timezone}</p>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={booking}
                className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
              >
                {booking ? 'Booking...' : 'Confirm Booking'}
              </button>

              <p className="text-xs text-gray-500 mt-4 text-center">
                You&apos;ll receive a confirmation email and calendar invitation.
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Main slot selection screen
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b">
            {/* You can add the LiveSchool logo here */}
            {/* <img src="/liveschool-logo.png" alt="LiveSchool" className="h-8 mb-4" /> */}

            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>

            <div className="flex flex-wrap gap-4 mt-3 text-gray-600">
              <span className="flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
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
            </div>

            {event.description && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
          </div>

          {/* Time slots */}
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Select a date and time</h2>
              <span className="text-sm text-gray-500">{timezone}</span>
            </div>

            {Object.keys(groupedSlots).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No available times at the moment. Please check back later.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedSlots).map(([date, dateSlots]) => (
                  <div key={date}>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {formatInTimeZone(parseISO(dateSlots[0].start_time), timezone, 'EEEE, MMMM d, yyyy')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {dateSlots.map((slot) => {
                        const isFull = slot.booking_count >= event.max_attendees;
                        return (
                          <button
                            key={slot.id}
                            onClick={() => !isFull && setSelectedSlot(slot)}
                            disabled={isFull}
                            className={`px-4 py-2 rounded-lg border transition ${
                              isFull
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
                            }`}
                          >
                            {formatInTimeZone(parseISO(slot.start_time), timezone, 'h:mm a')}
                            {isFull && ' (Full)'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="p-4 bg-gray-50 border-t text-center">
            <p className="text-sm text-gray-500">
              Web conferencing details provided upon confirmation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
