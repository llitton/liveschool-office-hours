'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

interface Poll {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  status: 'open' | 'closed' | 'booked';
  created_at: string;
  total_participants: number;
  options: Array<{
    id: string;
    start_time: string;
    vote_count: number;
  }>;
}

export default function PollsListPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    try {
      const res = await fetch('/api/polls');
      if (!res.ok) throw new Error('Failed to fetch polls');
      const data = await res.json();
      setPolls(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async (slug: string) => {
    const url = `${window.location.origin}/vote/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const deletePoll = async (id: string) => {
    if (!confirm('Delete this poll? This cannot be undone.')) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/polls/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete poll');
      setPolls(polls.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Collecting Votes
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            Closed
          </span>
        );
      case 'booked':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Booked
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#101E57]">Meeting Polls</h1>
          <p className="text-[#667085] mt-1">
            Let participants vote on their preferred meeting times
          </p>
        </div>
        <Link
          href="/admin/polls/new"
          className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Poll
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {polls.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="w-16 h-16 bg-[#6F71EE]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">No polls yet</h2>
          <p className="text-[#667085] mb-6 max-w-md mx-auto">
            Create a poll to let participants vote on their preferred meeting times.
            Perfect for finding a time that works for everyone.
          </p>
          <Link
            href="/admin/polls/new"
            className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-6 py-3 rounded-lg hover:bg-[#5a5cd0] transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Poll
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Poll
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time Options
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Participants
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {polls.map((poll) => {
                const topOption = poll.options?.reduce(
                  (top, opt) => (opt.vote_count > (top?.vote_count || 0) ? opt : top),
                  poll.options?.[0]
                );

                return (
                  <tr key={poll.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/admin/polls/${poll.id}`} className="group">
                        <p className="font-medium text-[#101E57] group-hover:text-[#6F71EE]">
                          {poll.title}
                        </p>
                        <p className="text-sm text-[#667085]">
                          {poll.duration_minutes} min
                        </p>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#667085]">
                        {poll.options?.length || 0} options
                        {topOption && poll.total_participants > 0 && (
                          <p className="text-xs">
                            Top: {format(parseISO(topOption.start_time), 'MMM d, h:mm a')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#101E57] font-medium">
                        {poll.total_participants}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(poll.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/polls/${poll.id}`}
                          className="p-2 text-[#667085] hover:text-[#6F71EE] hover:bg-[#6F71EE]/10 rounded-lg transition"
                          title="View results"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </Link>
                        {poll.status === 'open' && (
                          <button
                            onClick={() => copyLink(poll.slug)}
                            className="p-2 text-[#667085] hover:text-[#6F71EE] hover:bg-[#6F71EE]/10 rounded-lg transition"
                            title="Copy voting link"
                          >
                            {copiedSlug === poll.slug ? (
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                              </svg>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => deletePoll(poll.id)}
                          disabled={deleting === poll.id}
                          className="p-2 text-[#667085] hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === poll.id ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* How it works */}
      <div className="mt-6 bg-[#F6F6F9] rounded-lg p-4">
        <h3 className="font-medium text-[#101E57] mb-2">How Meeting Polls work</h3>
        <ul className="text-sm text-[#667085] space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE]">1.</span>
            Create a poll with multiple time options
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE]">2.</span>
            Share the voting link with participants
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE]">3.</span>
            Participants vote on times that work for them
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#6F71EE]">4.</span>
            Pick the winning time and book the meeting
          </li>
        </ul>
      </div>
    </div>
  );
}
