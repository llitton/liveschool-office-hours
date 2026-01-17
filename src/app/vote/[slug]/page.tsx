'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { OHPollOption, VoteType } from '@/types';

interface PollData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  location: string | null;
  show_votes: boolean;
  max_votes_per_person: number | null;
  status: 'open' | 'closed' | 'booked';
  host: {
    name: string | null;
    email: string;
    profile_image: string | null;
  };
  options: Array<OHPollOption & {
    votes?: Array<{ voter_name: string; vote_type: VoteType }>;
  }>;
  total_participants: number;
}

interface SelectedVote {
  option_id: string;
  vote_type: VoteType;
}

export default function VotePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Voting state
  const [selectedVotes, setSelectedVotes] = useState<SelectedVote[]>([]);
  const [voterName, setVoterName] = useState('');
  const [voterEmail, setVoterEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Timezone
  const [timezone, setTimezone] = useState('America/New_York');

  useEffect(() => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(userTimezone);
  }, []);

  useEffect(() => {
    fetchPoll();
  }, [slug]);

  const fetchPoll = async () => {
    try {
      const res = await fetch(`/api/polls/by-slug/${slug}`);
      if (!res.ok) {
        throw new Error('Poll not found');
      }
      const data = await res.json();
      setPoll(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const toggleVote = (optionId: string, voteType: VoteType = 'yes') => {
    const existingIndex = selectedVotes.findIndex((v) => v.option_id === optionId);

    if (existingIndex >= 0) {
      // If same type, remove. If different type, update.
      if (selectedVotes[existingIndex].vote_type === voteType) {
        setSelectedVotes(selectedVotes.filter((v) => v.option_id !== optionId));
      } else {
        const newVotes = [...selectedVotes];
        newVotes[existingIndex].vote_type = voteType;
        setSelectedVotes(newVotes);
      }
    } else {
      // Check max votes
      if (poll?.max_votes_per_person && selectedVotes.length >= poll.max_votes_per_person) {
        setError(`Maximum ${poll.max_votes_per_person} votes allowed`);
        return;
      }
      setSelectedVotes([...selectedVotes, { option_id: optionId, vote_type: voteType }]);
    }
    setError('');
  };

  const getVoteForOption = (optionId: string): VoteType | null => {
    const vote = selectedVotes.find((v) => v.option_id === optionId);
    return vote?.vote_type || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!voterName.trim() || !voterEmail.trim()) {
      setError('Please enter your name and email');
      return;
    }

    if (selectedVotes.length === 0) {
      setError('Please select at least one time that works for you');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/polls/${poll?.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voter_name: voterName,
          voter_email: voterEmail,
          votes: selectedVotes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit votes');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit votes');
    } finally {
      setSubmitting(false);
    }
  };

  // Group options by date
  const groupedOptions = (poll?.options || []).reduce((acc, option) => {
    const date = format(parseISO(option.start_time), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(option);
    return acc;
  }, {} as Record<string, PollData['options']>);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <div className="animate-pulse text-[#667085]">Loading poll...</div>
      </div>
    );
  }

  if (error && !poll) {
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
          <p className="text-[#667085]">This poll may not exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  if (!poll) return null;

  // Poll closed or booked
  if (poll.status !== 'open') {
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
            {poll.status === 'booked' ? 'Meeting Scheduled!' : 'Voting Closed'}
          </h1>
          <p className="text-[#667085]">
            {poll.status === 'booked'
              ? 'This poll has been finalized and the meeting has been scheduled. Check your email for details.'
              : 'This poll is no longer accepting votes.'}
          </p>
        </div>
      </div>
    );
  }

  // Submitted confirmation
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-[#417762] text-white p-6 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold">Votes Submitted!</h1>
              <p className="text-white/80 mt-1">Thanks for letting us know your availability</p>
            </div>

            <div className="p-6">
              <div className="bg-[#F6F6F9] rounded-lg p-4 mb-6">
                <h3 className="font-medium text-[#101E57] mb-2">What happens next?</h3>
                <p className="text-sm text-[#667085]">
                  The organizer will review everyone&apos;s votes and book the meeting at the best time.
                  You&apos;ll receive a calendar invite once the meeting is scheduled.
                </p>
              </div>

              <div className="text-center">
                <p className="text-[#667085] text-sm">
                  You voted for {selectedVotes.length} time{selectedVotes.length !== 1 ? 's' : ''}
                </p>
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

  // Main voting form
  return (
    <div className="min-h-screen bg-[#F6F6F9] py-12 px-4">
      <div className="max-w-2xl mx-auto">
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
            <h1 className="text-xl font-semibold">{poll.title}</h1>
            {poll.description && (
              <p className="text-white/80 mt-1">{poll.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-white/80 text-sm">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {poll.duration_minutes} min
              </span>
              {poll.location && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {poll.location}
                </span>
              )}
              {poll.host?.name && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {poll.host.name}
                </span>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 bg-[#6F71EE]/5 border-b border-[#6F71EE]/20">
            <p className="text-sm text-[#6F71EE] flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Select all the times that work for you
              {poll.max_votes_per_person && ` (max ${poll.max_votes_per_person})`}
            </p>
          </div>

          {error && (
            <div className="mx-6 mt-4 bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Time options */}
            <div className="p-6 space-y-6">
              {Object.entries(groupedOptions).map(([date, options]) => (
                <div key={date}>
                  <h3 className="font-medium text-[#101E57] mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatInTimeZone(parseISO(options[0].start_time), timezone, 'EEEE, MMMM d, yyyy')}
                  </h3>

                  <div className="space-y-2">
                    {options.map((option) => {
                      const currentVote = getVoteForOption(option.id);
                      const isSelected = currentVote !== null;

                      return (
                        <div
                          key={option.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition cursor-pointer ${
                            isSelected
                              ? currentVote === 'yes'
                                ? 'border-[#417762] bg-[#417762]/5'
                                : 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 hover:border-[#6F71EE]/50'
                          }`}
                          onClick={() => toggleVote(option.id, 'yes')}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                                isSelected
                                  ? currentVote === 'yes'
                                    ? 'border-[#417762] bg-[#417762]'
                                    : 'border-amber-500 bg-amber-500'
                                  : 'border-gray-300'
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-[#101E57]">
                                {formatInTimeZone(parseISO(option.start_time), timezone, 'h:mm a')}
                                {' - '}
                                {formatInTimeZone(parseISO(option.end_time), timezone, 'h:mm a')}
                              </span>
                              {poll.show_votes && option.votes && option.votes.length > 0 && (
                                <div className="text-xs text-[#667085] mt-0.5">
                                  {option.votes.map((v) => v.voter_name).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {option.vote_count > 0 && (
                              <span className="text-xs bg-[#F6F6F9] text-[#667085] px-2 py-1 rounded-full">
                                {option.vote_count} vote{option.vote_count !== 1 ? 's' : ''}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleVote(option.id, 'maybe');
                              }}
                              className={`text-xs px-2 py-1 rounded transition ${
                                currentVote === 'maybe'
                                  ? 'bg-amber-500 text-white'
                                  : 'text-[#667085] hover:bg-gray-100'
                              }`}
                              title="If needed"
                            >
                              If needed
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Voter info */}
            <div className="p-6 bg-[#F6F6F9] border-t">
              <h3 className="font-medium text-[#101E57] mb-4">Your Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={voterName}
                    onChange={(e) => setVoterName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={voterEmail}
                    onChange={(e) => setVoterEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="p-6 border-t">
              <button
                type="submit"
                disabled={submitting || selectedVotes.length === 0}
                className="w-full bg-[#6F71EE] text-white py-3 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
              >
                {submitting ? 'Submitting...' : `Submit Vote${selectedVotes.length > 1 ? 's' : ''} (${selectedVotes.length} selected)`}
              </button>
              <p className="text-xs text-[#667085] mt-2 text-center">
                Votes are final and cannot be changed after submission
              </p>
            </div>
          </form>
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
