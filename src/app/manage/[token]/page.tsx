'use client';

import { useState, useEffect, use } from 'react';
import { format, parseISO, isPast, differenceInHours } from 'date-fns';
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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [otherReason, setOtherReason] = useState('');

  const cancellationReasons = [
    'Schedule conflict',
    'No longer needed',
    'Booked wrong event',
    'Found another solution',
    'Other',
  ];

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
    const reason = cancellationReason === 'Other' ? otherReason : cancellationReason;
    if (!reason) return;

    setProcessing(true);
    setError('');

    try {
      const response = await fetch(`/api/manage/${token}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel booking');
      }

      setSuccess('Your booking has been cancelled. You will receive a confirmation email.');
      setShowCancelModal(false);
      setCancellationReason('');
      setOtherReason('');
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
  const isWaitlisted = booking.is_waitlisted;
  const isAttended = !!booking.attended_at;
  const hasPassed = isPast(parseISO(slot.end_time));
  const isMissed = hasPassed && !isCancelled && !isWaitlisted && !isAttended;
  const hoursSinceMeeting = hasPassed ? differenceInHours(new Date(), parseISO(slot.end_time)) : 0;
  const availableSlotsForReschedule = data.availableSlots.filter((s) => s.id !== slot.id);

  return (
    <div className="min-h-screen bg-[#F6F6F9] py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header - changes color based on status */}
          <div className={`p-6 text-center ${
            isCancelled ? 'bg-gray-500 text-white'
            : isMissed ? 'bg-[#F6F6F9]'
            : isWaitlisted ? 'bg-amber-500 text-white'
            : isAttended ? 'bg-[#417762] text-white'
            : 'bg-[#101E57] text-white'
          }`}>
            <Image
              src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
              alt="LiveSchool"
              width={120}
              height={32}
              className={`mx-auto mb-4 ${isMissed ? 'opacity-60' : 'brightness-0 invert'}`}
            />
            {isCancelled ? (
              <>
                <h1 className="text-xl font-semibold">
                  {isWaitlisted ? 'Removed from Waitlist' : 'Booking Cancelled'}
                </h1>
                <p className="text-white/80 mt-1">
                  {isWaitlisted ? "You've left the waitlist" : 'This session has been cancelled'}
                </p>
              </>
            ) : isMissed ? (
              <>
                <div className="w-14 h-14 bg-[#667085]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold text-[#101E57]">We missed you!</h1>
                <p className="text-[#667085] mt-1">
                  {hoursSinceMeeting < 24
                    ? "Your session was earlier today"
                    : hoursSinceMeeting < 48
                    ? "Your session was yesterday"
                    : `Your session was on ${formatInTimeZone(parseISO(slot.start_time), timezone, 'MMMM d')}`}
                </p>
              </>
            ) : isWaitlisted ? (
              <>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold">#{booking.waitlist_position}</span>
                </div>
                <h1 className="text-xl font-semibold">You&apos;re on the waitlist</h1>
                <p className="text-white/80 mt-1">We&apos;ll email you if a spot opens up</p>
              </>
            ) : isAttended ? (
              <>
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold">Thanks for joining, {booking.first_name}!</h1>
                <p className="text-white/80 mt-1">We hope it was helpful</p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold">Hi {booking.first_name}!</h1>
                <p className="text-white/80 mt-1">Here are your booking details</p>
              </>
            )}
          </div>

          {/* Booking Details */}
          <div className="p-6">
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-4 text-sm flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{success}</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4 text-sm flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Session details card - hide for missed meetings (shown differently there) */}
            {!isMissed && (
            <div className={`bg-[#F6F6F9] rounded-lg p-4 mb-6 ${isCancelled ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#6F71EE]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-[#101E57]">{event.name}</h2>
                  <p className="text-sm text-[#667085]">with {event.host_name}</p>
                  <p className="text-[#667085] mt-2">
                    {formatInTimeZone(parseISO(slot.start_time), timezone, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-[#101E57] font-medium">
                    {formatInTimeZone(parseISO(slot.start_time), timezone, 'h:mm a')} -{' '}
                    {formatInTimeZone(parseISO(slot.end_time), timezone, 'h:mm a')}
                  </p>
                  <p className="text-[#667085] text-sm">{timezone}</p>
                </div>
              </div>

              {/* Google Meet button - not for waitlisted */}
              {slot.google_meet_link && !isCancelled && !isWaitlisted && (
                <a
                  href={slot.google_meet_link}
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
            )}

            {/* Add to Calendar - only for confirmed, upcoming bookings */}
            {!isCancelled && !isWaitlisted && !isMissed && !showReschedule && (
              <div className="mb-6">
                <p className="text-sm font-medium text-[#101E57] mb-2">Add to your calendar:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={downloadIcal}
                    className="flex items-center gap-2 px-3 py-2 bg-[#F6F6F9] text-[#101E57] rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download .ics
                  </button>
                  <a
                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name)}&dates=${format(parseISO(slot.start_time), "yyyyMMdd'T'HHmmss'Z'")}/${format(parseISO(slot.end_time), "yyyyMMdd'T'HHmmss'Z'")}&details=${encodeURIComponent(`Join: ${slot.google_meet_link || 'Link in calendar invite'}`)}&location=${encodeURIComponent(slot.google_meet_link || 'Google Meet')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-[#F6F6F9] text-[#101E57] rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Google Calendar
                  </a>
                </div>
              </div>
            )}

            {/* Waitlist info section */}
            {!isCancelled && isWaitlisted && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h3 className="font-medium text-amber-800 mb-2">How the waitlist works</h3>
                <ul className="text-sm text-amber-700 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    You&apos;ll get an email immediately if a spot opens
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    Your position may improve as others cancel
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    First on the list gets the first available spot
                  </li>
                </ul>
              </div>
            )}

            {/* Reschedule Section - only for confirmed, upcoming bookings */}
            {!isCancelled && !isWaitlisted && !isMissed && showReschedule && (
              <div className="mb-6 p-4 bg-[#6F71EE]/5 border border-[#6F71EE]/20 rounded-lg">
                <h3 className="font-medium text-[#101E57] mb-1">Pick a new time</h3>
                <p className="text-sm text-[#667085] mb-4">Your current slot will be released for others to book.</p>
                {availableSlotsForReschedule.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-[#667085] text-sm mb-2">No other time slots available right now.</p>
                    <p className="text-[#667085] text-xs">Check back later or contact the host.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableSlotsForReschedule.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSlot(s.id)}
                        className={`w-full text-left px-3 py-3 rounded-lg border transition ${
                          selectedSlot === s.id
                            ? 'border-[#6F71EE] bg-white shadow-sm'
                            : 'border-gray-200 bg-white hover:border-[#6F71EE]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-[#101E57]">
                              {formatInTimeZone(parseISO(s.start_time), timezone, 'EEEE, MMMM d')}
                            </p>
                            <p className="text-sm text-[#667085]">
                              {formatInTimeZone(parseISO(s.start_time), timezone, 'h:mm a')}
                            </p>
                          </div>
                          {selectedSlot === s.id && (
                            <div className="w-5 h-5 bg-[#6F71EE] rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleReschedule}
                    disabled={!selectedSlot || processing}
                    className="flex-1 px-4 py-2.5 bg-[#6F71EE] text-white rounded-lg text-sm font-medium hover:bg-[#5a5cd0] transition disabled:opacity-50"
                  >
                    {processing ? 'Rescheduling...' : 'Confirm New Time'}
                  </button>
                  <button
                    onClick={() => {
                      setShowReschedule(false);
                      setSelectedSlot(null);
                    }}
                    className="px-4 py-2.5 text-[#667085] text-sm font-medium hover:text-[#101E57] transition"
                  >
                    Keep Current
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons for confirmed bookings */}
            {!isCancelled && !isWaitlisted && !isMissed && !showReschedule && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[#101E57]">Need to make changes?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowReschedule(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#6F71EE] text-white rounded-lg font-medium hover:bg-[#5a5cd0] transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Reschedule
                  </button>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-[#667085] rounded-lg font-medium hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-[#667085] text-center">
                  You&apos;ll receive an email confirmation for any changes
                </p>
              </div>
            )}

            {/* Action button for waitlisted users */}
            {!isCancelled && isWaitlisted && (
              <div className="text-center">
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={processing}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-gray-300 text-[#667085] rounded-lg font-medium hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Leave Waitlist
                </button>
                <p className="text-xs text-[#667085] mt-2">
                  You can always book again if more sessions become available
                </p>
              </div>
            )}

            {/* Missed meeting state */}
            {isMissed && (
              <div className="space-y-5">
                {/* Empathy message */}
                <div className="bg-[#F6F6F9] rounded-lg p-4">
                  <p className="text-[#101E57] font-medium mb-1">No worries—life happens!</p>
                  <p className="text-sm text-[#667085]">
                    We&apos;d still love to connect. Pick a new time that works better for you.
                  </p>
                </div>

                {/* Session that was missed */}
                <div className="border border-gray-200 rounded-lg p-4 opacity-60">
                  <div className="flex items-center gap-2 text-[#667085] text-xs mb-2 uppercase tracking-wide">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Missed session
                  </div>
                  <p className="text-[#101E57] font-medium">{event.name}</p>
                  <p className="text-sm text-[#667085]">
                    {formatInTimeZone(parseISO(slot.start_time), timezone, 'EEEE, MMMM d')} at {formatInTimeZone(parseISO(slot.start_time), timezone, 'h:mm a')}
                  </p>
                </div>

                {/* Book new session CTA */}
                <a
                  href={`/book/${event.slug}`}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-[#6F71EE] text-white rounded-lg font-medium hover:bg-[#5a5cd0] transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Book a New Time
                </a>

                {/* Quick feedback */}
                <div className="pt-4 border-t">
                  <p className="text-sm text-[#667085] text-center mb-3">
                    Help us understand what happened (optional)
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['Forgot', 'Conflict came up', 'Couldn\'t find link', 'Tech issues'].map((reason) => (
                      <button
                        key={reason}
                        onClick={() => {
                          // Could send feedback to analytics
                          setSuccess(`Thanks for letting us know!`);
                        }}
                        className="px-3 py-1.5 text-xs border border-gray-200 text-[#667085] rounded-full hover:border-[#6F71EE] hover:text-[#6F71EE] transition"
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cancelled state - offer to rebook */}
            {isCancelled && (
              <div className="text-center py-4">
                <p className="text-[#667085] mb-4">
                  Want to book a new session?
                </p>
                <a
                  href={`/book/${event.slug}`}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#6F71EE] text-white rounded-lg font-medium hover:bg-[#5a5cd0] transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Book New Session
                </a>
              </div>
            )}

            {/* Prep Materials - only for confirmed bookings */}
            {event.prep_materials && !isCancelled && !isWaitlisted && !isMissed && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-medium text-[#101E57] mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Before your session
                </h3>
                <div className="text-sm text-[#667085] whitespace-pre-wrap bg-[#F6F6F9] rounded-lg p-3">
                  {event.prep_materials}
                </div>
              </div>
            )}

            {/* Certificate of Attendance - only for attended sessions */}
            {!isCancelled && !isWaitlisted && booking.attended_at && (
              <div className="mt-6 pt-6 border-t">
                <div className="bg-[#417762]/10 rounded-lg p-4 text-center">
                  <div className="w-10 h-10 bg-[#417762] rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-[#101E57] mb-1">Thanks for attending!</h3>
                  <p className="text-sm text-[#667085] mb-4">
                    Download your certificate for professional development records.
                  </p>
                  <a
                    href={`/api/manage/${token}/certificate`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#417762] text-white rounded-lg font-medium hover:bg-[#355f4f] transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Certificate
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-[#F6F6F9] border-t text-center">
            <p className="text-sm text-[#667085]">
              Questions? Reply to your confirmation email or contact the host directly.
            </p>
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

      {/* Cancellation Reason Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[#101E57] mb-2">
                {isWaitlisted ? 'Leave Waitlist?' : 'Cancel Booking?'}
              </h3>
              <p className="text-[#667085] text-sm mb-4">
                {isWaitlisted
                  ? 'Let us know why you\'re leaving the waitlist so we can improve.'
                  : 'We\'re sorry to see you go! Let us know why so we can improve.'}
              </p>

              <div className="space-y-2 mb-4">
                {cancellationReasons.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setCancellationReason(reason)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                      cancellationReason === reason
                        ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#101E57]">{reason}</span>
                      {cancellationReason === reason && (
                        <div className="w-5 h-5 bg-[#6F71EE] rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {cancellationReason === 'Other' && (
                <div className="mb-4">
                  <textarea
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    placeholder="Please let us know why..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancellationReason('');
                    setOtherReason('');
                  }}
                  className="flex-1 px-4 py-2.5 text-[#667085] text-sm font-medium hover:text-[#101E57] transition"
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancel}
                  disabled={processing || !cancellationReason || (cancellationReason === 'Other' && !otherReason.trim())}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
                >
                  {processing ? 'Cancelling...' : (isWaitlisted ? 'Leave Waitlist' : 'Cancel Booking')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
