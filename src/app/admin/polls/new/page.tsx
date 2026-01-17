'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, addDays, setHours, setMinutes, parseISO, addMinutes } from 'date-fns';

interface TimeOption {
  id: string;
  date: string;
  start: string;
  end: string;
}

export default function NewPollPage() {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'times' | 'success'>('details');

  // Poll details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState('Google Meet');
  const [showVotes, setShowVotes] = useState(false);
  const [maxVotes, setMaxVotes] = useState<number | null>(null);

  // Time selection
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeOptions, setTimeOptions] = useState<TimeOption[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdPoll, setCreatedPoll] = useState<{
    slug: string;
    poll_url: string;
    title: string;
  } | null>(null);

  // Generate next 14 days for the date picker
  const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  // Time slot options (every 30 minutes from 8am to 6pm)
  const timeSlots = [];
  for (let hour = 8; hour < 18; hour++) {
    for (let minute of [0, 30]) {
      const time = setMinutes(setHours(new Date(), hour), minute);
      timeSlots.push(format(time, 'HH:mm'));
    }
  }

  const addTimeOption = (time: string) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existingOption = timeOptions.find(
      (o) => o.date === dateStr && o.start === time
    );

    if (existingOption) {
      // Remove if already selected
      setTimeOptions(timeOptions.filter((o) => o.id !== existingOption.id));
    } else {
      // Add new option
      const startDateTime = parseISO(`${dateStr}T${time}:00`);
      const endDateTime = addMinutes(startDateTime, duration);

      setTimeOptions([
        ...timeOptions,
        {
          id: `${dateStr}-${time}`,
          date: dateStr,
          start: time,
          end: format(endDateTime, 'HH:mm'),
        },
      ]);
    }
  };

  const removeTimeOption = (id: string) => {
    setTimeOptions(timeOptions.filter((o) => o.id !== id));
  };

  const isTimeSelected = (time: string) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return timeOptions.some((o) => o.date === dateStr && o.start === time);
  };

  const handleCreatePoll = async () => {
    if (!title.trim()) {
      setError('Please enter a poll title');
      return;
    }

    if (timeOptions.length === 0) {
      setError('Please select at least one time option');
      return;
    }

    if (timeOptions.length > 40) {
      setError('Maximum 40 time options allowed');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Format time options for API
      const formattedOptions = timeOptions.map((opt) => {
        const startDateTime = parseISO(`${opt.date}T${opt.start}:00`);
        const endDateTime = addMinutes(startDateTime, duration);
        return {
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
        };
      });

      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          duration_minutes: duration,
          location,
          time_options: formattedOptions,
          show_votes: showVotes,
          max_votes_per_person: maxVotes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create poll');
      }

      setCreatedPoll({
        slug: data.slug,
        poll_url: data.poll_url,
        title: data.title,
      });
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create poll');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  // Success screen
  if (step === 'success' && createdPoll) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-[#417762] text-white p-6 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold">Poll Created!</h1>
            <p className="text-white/80 mt-1">Share this link to collect votes</p>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#667085] mb-2">
                Poll Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdPoll.poll_url}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-[#101E57] text-sm"
                />
                <button
                  onClick={() => copyToClipboard(createdPoll.poll_url)}
                  className="px-4 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy
                </button>
              </div>
            </div>

            <div className="bg-[#F6F6F9] rounded-lg p-4 mb-6">
              <h3 className="font-medium text-[#101E57] mb-2">What happens next?</h3>
              <ul className="text-sm text-[#667085] space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-[#6F71EE] font-bold">1.</span>
                  Share the link with participants
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#6F71EE] font-bold">2.</span>
                  They vote on times that work for them
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#6F71EE] font-bold">3.</span>
                  You pick the winning time and book the meeting
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#6F71EE] font-bold">4.</span>
                  Calendar invites are sent automatically
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Link
                href={`/admin/polls/${createdPoll.slug}`}
                className="flex-1 bg-[#6F71EE] text-white py-3 rounded-lg hover:bg-[#5a5cd0] transition text-center font-medium"
              >
                View Poll Results
              </Link>
              <Link
                href="/admin/polls"
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-[#667085]"
              >
                Done
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Time selection step
  if (step === 'times') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          onClick={() => setStep('details')}
          className="text-[#6F71EE] hover:text-[#5a5cd0] mb-4 flex items-center gap-1 font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to details
        </button>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-semibold text-[#101E57]">Select Time Options</h1>
            <p className="text-[#667085] mt-1">
              Choose the times you want to offer. Participants will vote on their preferences.
            </p>
          </div>

          {error && (
            <div className="mx-6 mt-6 bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Date selector */}
              <div>
                <h3 className="font-medium text-[#101E57] mb-3">Select a date</h3>
                <div className="grid grid-cols-2 gap-2">
                  {dates.map((date) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const hasOptions = timeOptions.some((o) => o.date === dateStr);
                    const isSelected = format(selectedDate, 'yyyy-MM-dd') === dateStr;

                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDate(date)}
                        className={`p-3 rounded-lg border text-left transition ${
                          isSelected
                            ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                            : 'border-gray-200 hover:border-[#6F71EE]/50'
                        }`}
                      >
                        <div className="font-medium text-[#101E57]">
                          {format(date, 'EEE, MMM d')}
                        </div>
                        {hasOptions && (
                          <div className="text-xs text-[#6F71EE] mt-1">
                            {timeOptions.filter((o) => o.date === dateStr).length} times selected
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time selector */}
              <div>
                <h3 className="font-medium text-[#101E57] mb-3">
                  {format(selectedDate, 'EEEE, MMMM d')}
                </h3>
                <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
                  {timeSlots.map((time) => {
                    const isSelected = isTimeSelected(time);
                    return (
                      <button
                        key={time}
                        onClick={() => addTimeOption(time)}
                        className={`p-2 rounded-lg border text-sm transition ${
                          isSelected
                            ? 'border-[#6F71EE] bg-[#6F71EE] text-white'
                            : 'border-gray-200 hover:border-[#6F71EE] text-[#101E57]'
                        }`}
                      >
                        {format(parseISO(`2000-01-01T${time}:00`), 'h:mm a')}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected options summary */}
            {timeOptions.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-medium text-[#101E57] mb-3">
                  Selected Time Options ({timeOptions.length}/40)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {timeOptions
                    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
                    .map((opt) => (
                      <div
                        key={opt.id}
                        className="flex items-center gap-2 bg-[#F6F6F9] px-3 py-1.5 rounded-full text-sm"
                      >
                        <span className="text-[#101E57]">
                          {format(parseISO(opt.date), 'MMM d')} at{' '}
                          {format(parseISO(`2000-01-01T${opt.start}:00`), 'h:mm a')}
                        </span>
                        <button
                          onClick={() => removeTimeOption(opt.id)}
                          className="text-[#667085] hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
            <button
              onClick={() => setStep('details')}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition text-[#667085]"
            >
              Back
            </button>
            <button
              onClick={handleCreatePoll}
              disabled={saving || timeOptions.length === 0}
              className="px-6 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  Create Poll
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Details step (default)
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        href="/admin/polls"
        className="text-[#6F71EE] hover:text-[#5a5cd0] mb-4 flex items-center gap-1 font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to polls
      </Link>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-semibold text-[#101E57]">Create Meeting Poll</h1>
          <p className="text-[#667085] mt-1">
            Let participants vote on their preferred meeting times
          </p>
        </div>

        {error && (
          <div className="mx-6 mt-6 bg-red-50 text-red-700 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#101E57] mb-1">
              Poll Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Team Sync, Project Kickoff"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#101E57] mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's this meeting about?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
            />
          </div>

          {/* Duration & Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Location
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              >
                <option value="Google Meet">Google Meet</option>
                <option value="Zoom">Zoom</option>
                <option value="Microsoft Teams">Microsoft Teams</option>
                <option value="Phone Call">Phone Call</option>
                <option value="In Person">In Person</option>
              </select>
            </div>
          </div>

          {/* Settings */}
          <div className="pt-4 border-t">
            <h3 className="font-medium text-[#101E57] mb-3">Settings</h3>

            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={showVotes}
                onChange={(e) => setShowVotes(e.target.checked)}
                className="w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
              />
              <div>
                <span className="text-[#101E57]">Show votes to participants</span>
                <p className="text-sm text-[#667085]">
                  Let voters see who else voted for each option
                </p>
              </div>
            </label>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={maxVotes !== null}
                onChange={(e) => setMaxVotes(e.target.checked ? 3 : null)}
                className="w-4 h-4 mt-1 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
              />
              <div className="flex-1">
                <span className="text-[#101E57]">Limit votes per person</span>
                <p className="text-sm text-[#667085] mb-2">
                  Restrict how many options each person can vote for
                </p>
                {maxVotes !== null && (
                  <input
                    type="number"
                    value={maxVotes}
                    onChange={(e) => setMaxVotes(Math.max(1, Number(e.target.value)))}
                    min={1}
                    max={40}
                    className="w-24 px-3 py-1 border border-gray-300 rounded-lg text-sm text-[#101E57]"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <Link
            href="/admin/polls"
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition text-[#667085]"
          >
            Cancel
          </Link>
          <button
            onClick={() => {
              if (!title.trim()) {
                setError('Please enter a poll title');
                return;
              }
              setError('');
              setStep('times');
            }}
            className="px-6 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] transition flex items-center gap-2"
          >
            Next: Select Times
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
