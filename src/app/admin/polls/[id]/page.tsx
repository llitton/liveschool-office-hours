'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import type { OHPollOption, OHPollVote } from '@/types';

interface PollDetails {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  location: string | null;
  show_votes: boolean;
  max_votes_per_person: number | null;
  status: 'open' | 'closed' | 'booked';
  booked_option_id: string | null;
  created_at: string;
  options: Array<OHPollOption & { votes: OHPollVote[] }>;
  invitees: Array<{ id: string; name: string; email: string }>;
  total_participants: number;
  participants: string[];
}

interface AdditionalInvitee {
  name: string;
  email: string;
}

export default function PollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [poll, setPoll] = useState<PollDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Booking state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [additionalInvitees, setAdditionalInvitees] = useState<AdditionalInvitee[]>([]);
  const [newInviteeName, setNewInviteeName] = useState('');
  const [newInviteeEmail, setNewInviteeEmail] = useState('');
  const [booking, setBooking] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Action states
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetchPoll();
  }, [id]);

  const fetchPoll = async () => {
    try {
      const res = await fetch(`/api/polls/${id}`);
      if (!res.ok) throw new Error('Poll not found');
      const data = await res.json();
      setPoll(data);

      // Auto-select highest voted option
      if (data.options?.length > 0) {
        const sorted = [...data.options].sort((a, b) => b.vote_count - a.vote_count);
        setSelectedOption(sorted[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!poll) return;
    const url = `${window.location.origin}/vote/${poll.slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const closePoll = async () => {
    if (!confirm('Close this poll? Participants will no longer be able to vote.')) return;

    setClosing(true);
    try {
      const res = await fetch(`/api/polls/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
      if (!res.ok) throw new Error('Failed to close poll');
      await fetchPoll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close poll');
    } finally {
      setClosing(false);
    }
  };

  const reopenPoll = async () => {
    setClosing(true);
    try {
      const res = await fetch(`/api/polls/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen' }),
      });
      if (!res.ok) throw new Error('Failed to reopen poll');
      await fetchPoll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reopen poll');
    } finally {
      setClosing(false);
    }
  };

  const deletePoll = async () => {
    if (!confirm('Delete this poll? This action cannot be undone.')) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/polls/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete poll');
      router.push('/admin/polls');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete poll');
      setDeleting(false);
    }
  };

  const addInvitee = () => {
    if (!newInviteeName.trim() || !newInviteeEmail.trim()) return;

    setAdditionalInvitees([
      ...additionalInvitees,
      { name: newInviteeName, email: newInviteeEmail },
    ]);
    setNewInviteeName('');
    setNewInviteeEmail('');
  };

  const removeInvitee = (index: number) => {
    setAdditionalInvitees(additionalInvitees.filter((_, i) => i !== index));
  };

  const bookMeeting = async () => {
    if (!selectedOption) {
      setError('Please select a time option');
      return;
    }

    setBooking(true);
    setError('');

    try {
      const res = await fetch(`/api/polls/${id}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          option_id: selectedOption,
          additional_invitees: additionalInvitees,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to book meeting');

      setShowBookingModal(false);
      await fetchPoll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book meeting');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!poll) return null;

  const sortedOptions = [...(poll.options || [])].sort((a, b) => b.vote_count - a.vote_count);
  const maxVotes = Math.max(...sortedOptions.map((o) => o.vote_count), 1);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/admin/polls"
            className="text-[#6F71EE] hover:text-[#5a5cd0] mb-2 flex items-center gap-1 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to polls
          </Link>
          <h1 className="text-2xl font-semibold text-[#101E57]">{poll.title}</h1>
          {poll.description && (
            <p className="text-[#667085] mt-1">{poll.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {poll.status === 'open' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Collecting Votes
            </span>
          )}
          {poll.status === 'closed' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
              Closed
            </span>
          )}
          {poll.status === 'booked' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Booked
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Results */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-[#101E57]">
                Results ({poll.total_participants} participant{poll.total_participants !== 1 ? 's' : ''})
              </h2>
              {poll.status !== 'booked' && (
                <button
                  onClick={copyLink}
                  className="text-sm text-[#6F71EE] hover:text-[#5a5cd0] flex items-center gap-1"
                >
                  {copiedLink ? (
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
                      Copy voting link
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="divide-y">
              {sortedOptions.map((option, index) => {
                const percentage = maxVotes > 0 ? (option.vote_count / maxVotes) * 100 : 0;
                const isWinner = index === 0 && option.vote_count > 0;
                const isBooked = poll.booked_option_id === option.id;

                return (
                  <div
                    key={option.id}
                    className={`p-4 ${isBooked ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#101E57]">
                            {format(parseISO(option.start_time), 'EEE, MMM d')}
                          </span>
                          <span className="text-[#667085]">
                            {format(parseISO(option.start_time), 'h:mm a')} -{' '}
                            {format(parseISO(option.end_time), 'h:mm a')}
                          </span>
                          {isWinner && !isBooked && (
                            <span className="text-xs bg-[#417762] text-white px-2 py-0.5 rounded-full">
                              Most votes
                            </span>
                          )}
                          {isBooked && (
                            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                              Scheduled
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-[#101E57]">
                        {option.vote_count} vote{option.vote_count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Vote bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isBooked ? 'bg-blue-600' : isWinner ? 'bg-[#417762]' : 'bg-[#6F71EE]'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    {/* Voters */}
                    {option.votes && option.votes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {option.votes.map((vote) => (
                          <span
                            key={vote.id}
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              vote.vote_type === 'maybe'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-[#667085]'
                            }`}
                            title={vote.voter_email}
                          >
                            {vote.voter_name}
                            {vote.vote_type === 'maybe' && ' (if needed)'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-[#101E57] mb-3">Actions</h3>

            {poll.status === 'open' && (
              <>
                <button
                  onClick={() => setShowBookingModal(true)}
                  disabled={poll.total_participants === 0}
                  className="w-full bg-[#6F71EE] text-white py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 mb-2 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Book Meeting
                </button>
                <button
                  onClick={closePoll}
                  disabled={closing}
                  className="w-full border border-gray-300 text-[#667085] py-2 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 mb-2"
                >
                  {closing ? 'Closing...' : 'Close Voting'}
                </button>
              </>
            )}

            {poll.status === 'closed' && (
              <>
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="w-full bg-[#6F71EE] text-white py-2 rounded-lg hover:bg-[#5a5cd0] transition mb-2 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Book Meeting
                </button>
                <button
                  onClick={reopenPoll}
                  disabled={closing}
                  className="w-full border border-gray-300 text-[#667085] py-2 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 mb-2"
                >
                  {closing ? 'Reopening...' : 'Reopen Voting'}
                </button>
              </>
            )}

            <button
              onClick={deletePoll}
              disabled={deleting}
              className="w-full text-red-600 py-2 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Poll'}
            </button>
          </div>

          {/* Poll info */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-[#101E57] mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[#667085]">Duration</dt>
                <dd className="text-[#101E57]">{poll.duration_minutes} minutes</dd>
              </div>
              {poll.location && (
                <div>
                  <dt className="text-[#667085]">Location</dt>
                  <dd className="text-[#101E57]">{poll.location}</dd>
                </div>
              )}
              <div>
                <dt className="text-[#667085]">Created</dt>
                <dd className="text-[#101E57]">{format(parseISO(poll.created_at), 'MMM d, yyyy')}</dd>
              </div>
              <div>
                <dt className="text-[#667085]">Time Options</dt>
                <dd className="text-[#101E57]">{poll.options.length}</dd>
              </div>
            </dl>
          </div>

          {/* Participants */}
          {poll.participants.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-[#101E57] mb-3">
                Participants ({poll.participants.length})
              </h3>
              <ul className="space-y-1 text-sm">
                {poll.participants.map((email) => (
                  <li key={email} className="text-[#667085] truncate" title={email}>
                    {email}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-[#101E57]">Book Meeting</h2>
              <p className="text-[#667085] mt-1">
                Select a time and add any additional invitees
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Time selection */}
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Select Time
                </label>
                <div className="space-y-2">
                  {sortedOptions.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        selectedOption === option.id
                          ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                          : 'border-gray-200 hover:border-[#6F71EE]/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="option"
                        value={option.id}
                        checked={selectedOption === option.id}
                        onChange={() => setSelectedOption(option.id)}
                        className="text-[#6F71EE]"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-[#101E57]">
                          {format(parseISO(option.start_time), 'EEE, MMM d')} at{' '}
                          {format(parseISO(option.start_time), 'h:mm a')}
                        </div>
                        <div className="text-sm text-[#667085]">
                          {option.vote_count} vote{option.vote_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Additional invitees */}
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Add Invitees (who didn&apos;t vote)
                </label>

                {additionalInvitees.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {additionalInvitees.map((invitee, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg"
                      >
                        <div>
                          <span className="font-medium text-[#101E57]">{invitee.name}</span>
                          <span className="text-[#667085] text-sm ml-2">{invitee.email}</span>
                        </div>
                        <button
                          onClick={() => removeInvitee(index)}
                          className="text-[#667085] hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newInviteeName}
                    onChange={(e) => setNewInviteeName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newInviteeEmail}
                    onChange={(e) => setNewInviteeEmail(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={addInvitee}
                    disabled={!newInviteeName || !newInviteeEmail}
                    className="px-4 py-2 bg-gray-100 text-[#667085] rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowBookingModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition text-[#667085]"
              >
                Cancel
              </button>
              <button
                onClick={bookMeeting}
                disabled={booking || !selectedOption}
                className="px-4 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50"
              >
                {booking ? 'Booking...' : 'Book Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
