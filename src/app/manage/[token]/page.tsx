'use client';

import { useState, useEffect, use } from 'react';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import Image from 'next/image';
import type { OHEvent, OHSlot, OHBooking } from '@/types';

interface BookingData {
  booking: OHBooking;
  slot: OHSlot;
  event: OHEvent;
  availableSlots: Array<OHSlot & { booking_count: number }>;
}

export default function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');

  const [showReschedule, setShowReschedule] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(userTimezone);
  }, []);

  useEffect(() => {
    fetchBooking();
  }, [token]);

  const fetchBooking = async () => {
    try {
      const response = await fetch(`/api/manage/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Booking not found');
      }
      const bookingData = await response.json();
      setData(bookingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    setProcessing(true);
    setError('');

    try {
      const response = await fetch(`/api/manage/${token}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel booking');
      }

      setSuccess('Your booking has been cancelled. You will receive a confirmation email.');
      await fetchBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel booking');
    } finally {
      setProcessing(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedSlot) return;

    setProcessing(true);
    setError('');

    try {
      const response = await fetch(`/api/manage/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_slot_id: selectedSlot }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reschedule');
      }

      setSuccess('Your booking has been rescheduled! Check your email for the updated details.');
      setShowReschedule(false);
      setSelectedSlot(null);
      await fetchBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule');
    } finally {
      setProcessing(false);
    }
  };

  const downloadIcal = () => {
    if (!data) return;
    window.location.href = `/api/manage/${token}/ical`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <div className="animate-pulse text-[#667085]">Loading...</div>
      </div>
    );
  }

  if (error && !data) {
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
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-[#667085]">
            This booking link may be invalid or expired.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { booking, slot, event } = data;
  const isCancelled = !!booking.cancelled_at;

  return (
    <div className="min-h-screen bg-[#F6F6F9] py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b">
            <Image
              src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
              alt="LiveSchool"
              width={140}
              height={36}
              className="mb-4"
            />
            <h1 className="text-xl font-semibold text-[#101E57]">Manage Your Booking</h1>
          </div>

          {/* Booking Details */}
          <div className="p-6">
            {success && (
              <div className="bg-green-50 text-green-700 p-4 rounded mb-4 text-sm">
                {success}
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            <div className={`bg-[#F6F6F9] rounded-lg p-4 mb-6 ${isCancelled ? 'opacity-60' : ''}`}>
              {isCancelled && (
                <div className="bg-red-100 text-red-700 px-3 py-1 rounded text-sm font-medium mb-3 inline-block">
                  Cancelled
                </div>
              )}

              <h2 className="font-semibold text-[#101E57] text-lg">{event.name}</h2>
              <p className="text-[#667085] mt-1">with {event.host_name}</p>

              <div className="mt-4 space-y-2">
                <p className="text-[#101E57]">
                  <strong>Date:</strong>{' '}
                  {formatInTimeZone(parseISO(slot.start_time), timezone, 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-[#101E57]">
                  <strong>Time:</strong>{' '}
                  {formatInTimeZone(parseISO(slot.start_time), timezone, 'h:mm a')} -{' '}
                  {formatInTimeZone(parseISO(slot.end_time), timezone, 'h:mm a')}
                </p>
                <p className="text-[#667085] text-sm">{timezone}</p>

                {slot.google_meet_link && !isCancelled && (
                  <p className="mt-2">
                    <a
                      href={slot.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#6F71EE] hover:underline font-medium"
                    >
                      Join Google Meet →
                    </a>
                  </p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-[#667085]">
                  <strong>Attendee:</strong> {booking.first_name} {booking.last_name}
                </p>
                <p className="text-sm text-[#667085]">{booking.email}</p>
              </div>
            </div>

            {/* Add to Calendar */}
            {!isCancelled && (
              <div className="mb-6">
                <p className="text-sm font-medium text-[#101E57] mb-2">Add to Calendar:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={downloadIcal}
                    className="px-3 py-1.5 bg-[#F6F6F9] text-[#101E57] rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                  >
                    Apple Calendar / Outlook (.ics)
                  </button>
                  <a
                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name)}&dates=${format(parseISO(slot.start_time), "yyyyMMdd'T'HHmmss'Z'")}/${format(parseISO(slot.end_time), "yyyyMMdd'T'HHmmss'Z'")}&details=${encodeURIComponent(`Join: ${slot.google_meet_link || 'Link in calendar invite'}`)}&location=${encodeURIComponent(slot.google_meet_link || 'Google Meet')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-[#F6F6F9] text-[#101E57] rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                  >
                    Google Calendar
                  </a>
                </div>
              </div>
            )}

            {/* Reschedule Section */}
            {!isCancelled && showReschedule && (
              <div className="mb-6 p-4 bg-[#F6F6F9] rounded-lg">
                <h3 className="font-medium text-[#101E57] mb-3">Select a new time:</h3>
                {data.availableSlots.length === 0 ? (
                  <p className="text-[#667085] text-sm">No other time slots available.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {data.availableSlots
                      .filter((s) => s.id !== slot.id)
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedSlot(s.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                            selectedSlot === s.id
                              ? 'border-[#6F71EE] bg-[#6F71EE]/10'
                              : 'border-gray-200 hover:border-[#6F71EE]'
                          }`}
                        >
                          <p className="text-sm font-medium text-[#101E57]">
                            {formatInTimeZone(parseISO(s.start_time), timezone, 'EEEE, MMMM d')}
                          </p>
                          <p className="text-sm text-[#667085]">
                            {formatInTimeZone(parseISO(s.start_time), timezone, 'h:mm a')}
                          </p>
                        </button>
                      ))}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleReschedule}
                    disabled={!selectedSlot || processing}
                    className="px-4 py-2 bg-[#6F71EE] text-white rounded-lg text-sm font-medium hover:bg-[#5a5cd0] transition disabled:opacity-50"
                  >
                    {processing ? 'Rescheduling...' : 'Confirm New Time'}
                  </button>
                  <button
                    onClick={() => {
                      setShowReschedule(false);
                      setSelectedSlot(null);
                    }}
                    className="px-4 py-2 text-[#667085] text-sm font-medium hover:text-[#101E57]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!isCancelled && !showReschedule && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReschedule(true)}
                  className="flex-1 px-4 py-2 border border-[#6F71EE] text-[#6F71EE] rounded-lg font-medium hover:bg-[#6F71EE] hover:text-white transition"
                >
                  Reschedule
                </button>
                <button
                  onClick={handleCancel}
                  disabled={processing}
                  className="flex-1 px-4 py-2 border border-red-500 text-red-500 rounded-lg font-medium hover:bg-red-500 hover:text-white transition disabled:opacity-50"
                >
                  {processing ? 'Cancelling...' : 'Cancel Booking'}
                </button>
              </div>
            )}

            {/* Prep Materials */}
            {event.prep_materials && !isCancelled && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-medium text-[#101E57] mb-2">Preparation Materials</h3>
                <div className="text-sm text-[#667085] whitespace-pre-wrap">
                  {event.prep_materials}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-[#F6F6F9] border-t text-center">
            <p className="text-sm text-[#667085]">
              Questions? Reply to your confirmation email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
