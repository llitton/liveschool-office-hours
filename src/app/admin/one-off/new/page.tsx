'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  format,
  addDays,
  startOfDay,
  setHours,
  setMinutes,
  isBefore,
  parseISO,
} from 'date-fns';

interface TimeSlot {
  start: string;
  end: string;
}

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
}

export default function NewOneOffMeetingPage() {
  const router = useRouter();
  const [name, setName] = useState('Quick Meeting');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [singleUse, setSingleUse] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Calendar state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewWeekStart, setViewWeekStart] = useState<Date>(startOfDay(new Date()));

  // Team members for co-hosts
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedCoHosts, setSelectedCoHosts] = useState<string[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showCoHosts, setShowCoHosts] = useState(false);

  const fetchTeamMembers = async () => {
    if (teamMembers.length > 0) return;
    setLoadingTeam(true);
    try {
      const res = await fetch('/api/admin/team');
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data);
      }
    } catch (err) {
      console.error('Failed to fetch team:', err);
    } finally {
      setLoadingTeam(false);
    }
  };

  // Generate time options for the day (7am - 9pm in 30-min increments)
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 7; hour <= 21; hour++) {
      for (let min = 0; min < 60; min += 30) {
        if (hour === 21 && min > 0) break;
        options.push({ hour, min });
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const addTimeSlot = (hour: number, min: number) => {
    const slotStart = setMinutes(setHours(selectedDate, hour), min);
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

    // Don't add slots in the past
    if (isBefore(slotStart, new Date())) {
      return;
    }

    const newSlot: TimeSlot = {
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
    };

    // Check if slot already exists
    const exists = selectedSlots.some(
      (s) => s.start === newSlot.start && s.end === newSlot.end
    );

    if (!exists) {
      setSelectedSlots([...selectedSlots, newSlot].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      ));
    }
  };

  const removeTimeSlot = (slot: TimeSlot) => {
    setSelectedSlots(selectedSlots.filter((s) => s.start !== slot.start));
  };

  const isSlotSelected = (hour: number, min: number) => {
    const slotStart = setMinutes(setHours(selectedDate, hour), min);
    return selectedSlots.some(
      (s) => parseISO(s.start).getTime() === slotStart.getTime()
    );
  };

  const isSlotInPast = (hour: number, min: number) => {
    const slotStart = setMinutes(setHours(selectedDate, hour), min);
    return isBefore(slotStart, new Date());
  };

  const handleCreate = async () => {
    if (selectedSlots.length === 0) {
      setError('Please select at least one time slot');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/one-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          duration_minutes: duration,
          time_slots: selectedSlots,
          single_use: singleUse,
          co_host_ids: selectedCoHosts.length > 0 ? selectedCoHosts : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create meeting');
      }

      setCreatedLink(data.booking_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (createdLink) {
      navigator.clipboard.writeText(createdLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(viewWeekStart, i));

  if (createdLink) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[#101E57] mb-2">Meeting Created!</h1>
          <p className="text-[#667085] mb-6">
            Share this link with your invitee. {singleUse && 'The link will expire after booking.'}
          </p>

          <div className="bg-[#F6F6F9] rounded-lg p-4 mb-6">
            <p className="text-sm text-[#667085] mb-2">Booking Link</p>
            <p className="font-mono text-sm text-[#101E57] break-all">{createdLink}</p>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={copyLink}
              className="px-6 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5B5DD6] transition flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy Link
                </>
              )}
            </button>
            <Link
              href="/admin/one-off"
              className="px-6 py-2 border border-gray-300 text-[#101E57] rounded-lg hover:bg-gray-50 transition"
            >
              View All One-off Meetings
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t">
            <p className="text-sm text-[#667085] mb-3">Times offered:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {selectedSlots.map((slot, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-[#6F71EE]/10 text-[#6F71EE] rounded-full text-sm"
                >
                  {format(parseISO(slot.start), 'MMM d, h:mm a')}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-[#6F71EE] hover:underline text-sm flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-[#101E57] mb-2">Create One-off Meeting</h1>
      <p className="text-[#667085] mb-6">
        Create a quick scheduling link for a one-time meeting. Pick specific times to offer.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Meeting Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-[#101E57] mb-4">Meeting Details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Meeting Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Quick sync, Interview, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Add any notes for the invitee..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={singleUse}
                  onChange={(e) => setSingleUse(e.target.checked)}
                  className="w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
                />
                <span className="text-sm text-[#101E57]">Single-use link (expires after booking)</span>
              </label>
            </div>

            {/* Co-hosts */}
            <div>
              <button
                type="button"
                onClick={() => {
                  setShowCoHosts(!showCoHosts);
                  if (!showCoHosts) fetchTeamMembers();
                }}
                className="text-sm text-[#6F71EE] hover:underline"
              >
                {showCoHosts ? '− Hide co-hosts' : '+ Add co-hosts'}
              </button>

              {showCoHosts && (
                <div className="mt-3 border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {loadingTeam ? (
                    <p className="text-sm text-[#667085]">Loading team...</p>
                  ) : teamMembers.length === 0 ? (
                    <p className="text-sm text-[#667085]">No team members found</p>
                  ) : (
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <label key={member.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedCoHosts.includes(member.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCoHosts([...selectedCoHosts, member.id]);
                              } else {
                                setSelectedCoHosts(selectedCoHosts.filter((id) => id !== member.id));
                              }
                            }}
                            className="w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
                          />
                          <span className="text-sm text-[#101E57]">
                            {member.name || member.email}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selected times summary */}
          {selectedSlots.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-sm font-medium text-[#101E57] mb-2">
                Selected Times ({selectedSlots.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedSlots.map((slot, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-[#6F71EE]/10 text-[#6F71EE] rounded text-sm"
                  >
                    {format(parseISO(slot.start), 'MMM d, h:mm a')}
                    <button
                      onClick={() => removeTimeSlot(slot)}
                      className="hover:text-red-500"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={loading || selectedSlots.length === 0}
            className="w-full mt-6 px-4 py-3 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5B5DD6] transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Creating...' : 'Create Meeting Link'}
          </button>
        </div>

        {/* Right: Time Picker */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-[#101E57] mb-4">Select Times to Offer</h2>

          {/* Week navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setViewWeekStart(addDays(viewWeekStart, -7))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm text-[#667085]">
              {format(viewWeekStart, 'MMM d')} - {format(addDays(viewWeekStart, 6), 'MMM d, yyyy')}
            </span>
            <button
              onClick={() => setViewWeekStart(addDays(viewWeekStart, 7))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day selector */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {weekDays.map((day) => {
              const isSelected = format(selectedDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
              const isPast = isBefore(day, startOfDay(new Date()));

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => !isPast && setSelectedDate(day)}
                  disabled={isPast}
                  className={`p-2 rounded text-center ${
                    isSelected
                      ? 'bg-[#6F71EE] text-white'
                      : isPast
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'hover:bg-gray-100 text-[#101E57]'
                  }`}
                >
                  <div className="text-xs">{format(day, 'EEE')}</div>
                  <div className="font-medium">{format(day, 'd')}</div>
                </button>
              );
            })}
          </div>

          {/* Time slots */}
          <div className="max-h-80 overflow-y-auto">
            <p className="text-xs text-[#667085] mb-2">
              Click times to add them. {duration} min slots.
            </p>
            <div className="grid grid-cols-3 gap-1">
              {timeOptions.map(({ hour, min }) => {
                const isSelected = isSlotSelected(hour, min);
                const isPast = isSlotInPast(hour, min);

                return (
                  <button
                    key={`${hour}-${min}`}
                    onClick={() => !isPast && !isSelected && addTimeSlot(hour, min)}
                    disabled={isPast}
                    className={`px-2 py-1.5 text-sm rounded ${
                      isSelected
                        ? 'bg-[#6F71EE] text-white'
                        : isPast
                        ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                        : 'bg-gray-50 hover:bg-[#6F71EE]/10 text-[#101E57]'
                    }`}
                  >
                    {format(setMinutes(setHours(new Date(), hour), min), 'h:mm a')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
