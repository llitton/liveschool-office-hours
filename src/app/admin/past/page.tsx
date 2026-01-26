'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { PageContainer, PageHeader } from '@/components/AppShell';
import { Card, CardBody, EmptyState } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';
import { AttendanceBadge } from '@/components/ui/Badge';

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  google_meet_link: string | null;
  event: {
    id: string;
    name: string;
    slug: string;
    max_attendees: number;
  };
  attendeeCount: number;
  attendedCount: number;
  noShowCount: number;
  feedbackCount: number;
  averageRating: number | null;
}

interface FeedbackItem {
  id: string;
  attendee_name: string;
  attendee_email: string;
  rating: number;
  comment: string | null;
  topic_suggestion: string | null;
  submitted_at: string;
}

interface FeedbackModalData {
  session: {
    id: string;
    start_time: string;
    end_time: string;
    event_name: string;
  };
  feedback: FeedbackItem[];
  averageRating: number | null;
}

export default function PastPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackModal, setFeedbackModal] = useState<{
    open: boolean;
    loading: boolean;
    data: FeedbackModalData | null;
  }>({ open: false, loading: false, data: null });

  useEffect(() => {
    fetchSessions();
  }, []);

  const openFeedbackModal = async (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFeedbackModal({ open: true, loading: true, data: null });

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/feedback`);
      if (response.ok) {
        const data = await response.json();
        setFeedbackModal({ open: true, loading: false, data });
      } else {
        setFeedbackModal({ open: false, loading: false, data: null });
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
      setFeedbackModal({ open: false, loading: false, data: null });
    }
  };

  const closeFeedbackModal = () => {
    setFeedbackModal({ open: false, loading: false, data: null });
  };

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/sessions?period=past&limit=100');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group sessions by date (most recent first)
  const groupedSessions = sessions.reduce((acc, session) => {
    const dateKey = format(parseISO(session.start_time), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(session);
    return acc;
  }, {} as Record<string, Session[]>);

  const sortedDates = Object.keys(groupedSessions).sort().reverse();

  if (loading) {
    return (
      <>
        <PageContainer narrow>
          <PageHeader
            title="Past Sessions"
            description="Review completed sessions and attendance"
          />
          <Card>
            <CardBody>
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-32" />
                <div className="h-16 bg-gray-100 rounded" />
                <div className="h-16 bg-gray-100 rounded" />
              </div>
            </CardBody>
          </Card>
        </PageContainer>
      </>
    );
  }

  if (sessions.length === 0) {
    return (
      <>
        <PageContainer narrow>
          <PageHeader
            title="Past Sessions"
            description="Review completed sessions and attendance"
          />
          <EmptyState
            icon={
              <svg className="w-7 h-7 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="No past sessions yet"
            description="Once you run your first session, it will appear here."
            action={
              <LinkButton href="/admin" variant="tertiary">
                View today's sessions
              </LinkButton>
            }
          />
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <PageContainer narrow>
        <PageHeader
          title="Past Sessions"
          description="Review completed sessions and attendance"
        />

        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const date = parseISO(dateKey);
            const daySessions = groupedSessions[dateKey];
            const totalAttended = daySessions.reduce((sum, s) => sum + s.attendedCount, 0);
            const totalBooked = daySessions.reduce((sum, s) => sum + s.attendeeCount, 0);

            // Calculate daily feedback stats
            const totalFeedback = daySessions.reduce((sum, s) => sum + s.feedbackCount, 0);
            const avgRating = totalFeedback > 0
              ? daySessions.reduce((sum, s) => sum + (s.feedbackCount > 0 && s.averageRating ? s.averageRating * s.feedbackCount : 0), 0) / totalFeedback
              : null;

            return (
              <Card key={dateKey}>
                <div className="px-5 py-3 bg-[#FAFAFA] border-b border-[#E0E0E0] flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-[#101E57]">
                      {format(date, 'EEEE, MMMM d, yyyy')}
                    </h2>
                    <p className="text-sm text-[#667085]">
                      {formatDistanceToNow(date, { addSuffix: true })} · {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    {totalFeedback > 0 && avgRating !== null && (
                      <div className="text-right" title={`${totalFeedback} rating${totalFeedback !== 1 ? 's' : ''}`}>
                        <div className="text-sm font-medium text-[#F4B03D]">
                          {'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}
                        </div>
                        <div className="text-xs text-[#667085]">
                          {totalFeedback} feedback
                        </div>
                      </div>
                    )}
                    {totalBooked > 0 && (
                      <div className="text-right">
                        <div className="text-sm font-medium text-[#101E57]">
                          {totalAttended} / {totalBooked} attended
                        </div>
                        <div className="text-xs text-[#667085]">
                          {Math.round((totalAttended / totalBooked) * 100)}% attendance
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-[#E0E0E0]">
                  {daySessions.map((session) => {
                    const startTime = parseISO(session.start_time);
                    const endTime = parseISO(session.end_time);
                    const attendanceRate = session.attendeeCount > 0
                      ? Math.round((session.attendedCount / session.attendeeCount) * 100)
                      : null;

                    return (
                      <Link
                        key={session.id}
                        href={`/admin/events/${session.event.id}`}
                        className="flex items-center justify-between px-5 py-4 hover:bg-[#FAFAFA] transition group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[60px]">
                            <div className="font-semibold text-[#667085]">
                              {format(startTime, 'h:mm')}
                            </div>
                            <div className="text-xs text-[#667085]">
                              {format(startTime, 'a')}
                            </div>
                          </div>
                          <div className="h-10 w-px bg-[#E0E0E0]" />
                          <div>
                            <div className="font-medium text-[#101E57] group-hover:text-[#6F71EE] transition">
                              {session.event.name}
                            </div>
                            <div className="text-sm text-[#667085]">
                              {format(startTime, 'h:mm a')} – {format(endTime, 'h:mm a')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          {session.attendeeCount > 0 ? (
                            <>
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <div className="text-sm font-medium text-[#059669]">
                                    {session.attendedCount}
                                  </div>
                                  <div className="text-xs text-[#667085]">attended</div>
                                </div>
                                {session.noShowCount > 0 && (
                                  <div className="text-center">
                                    <div className="text-sm font-medium text-[#DC2626]">
                                      {session.noShowCount}
                                    </div>
                                    <div className="text-xs text-[#667085]">no-show</div>
                                  </div>
                                )}
                                {session.feedbackCount > 0 && session.averageRating !== null && (
                                  <button
                                    onClick={(e) => openFeedbackModal(session.id, e)}
                                    className="text-center hover:bg-[#F4B03D]/10 px-2 py-1 rounded-lg transition cursor-pointer"
                                    title="Click to view feedback details"
                                  >
                                    <div className="text-sm font-medium text-[#F4B03D] flex items-center gap-0.5">
                                      {'★'.repeat(Math.round(session.averageRating))}
                                      {'☆'.repeat(5 - Math.round(session.averageRating))}
                                    </div>
                                    <div className="text-xs text-[#667085]">
                                      {session.feedbackCount} feedback
                                    </div>
                                  </button>
                                )}
                              </div>
                              <AttendanceBadge rate={attendanceRate} />
                            </>
                          ) : (
                            <span className="text-sm text-[#667085]">No attendees</span>
                          )}

                          <svg className="w-5 h-5 text-[#667085] group-hover:text-[#6F71EE] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Feedback Modal */}
        {feedbackModal.open && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
              {feedbackModal.loading ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6F71EE]" />
                </div>
              ) : feedbackModal.data ? (
                <>
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-[#101E57]">
                        Session Feedback
                      </h2>
                      <p className="text-sm text-[#667085]">
                        {feedbackModal.data.session.event_name} · {format(parseISO(feedbackModal.data.session.start_time), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <button
                      onClick={closeFeedbackModal}
                      className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {feedbackModal.data.averageRating !== null && (
                    <div className="px-6 py-4 bg-[#FAFAFA] border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl text-[#F4B03D]">
                          {'★'.repeat(Math.round(feedbackModal.data.averageRating))}
                          {'☆'.repeat(5 - Math.round(feedbackModal.data.averageRating))}
                        </div>
                        <div className="text-sm text-[#667085]">
                          {feedbackModal.data.averageRating.toFixed(1)} average from {feedbackModal.data.feedback.length} response{feedbackModal.data.feedback.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="overflow-y-auto max-h-[50vh]">
                    {feedbackModal.data.feedback.length === 0 ? (
                      <div className="p-6 text-center text-[#667085]">
                        No feedback submitted yet
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {feedbackModal.data.feedback.map((item) => (
                          <div key={item.id} className="px-6 py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-[#101E57] truncate">
                                    {item.attendee_name}
                                  </span>
                                  <span className="text-[#F4B03D] text-sm">
                                    {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                                  </span>
                                </div>
                                <div className="text-xs text-[#667085] mt-0.5">
                                  {item.attendee_email}
                                </div>
                              </div>
                              <div className="text-xs text-[#667085] whitespace-nowrap">
                                {formatDistanceToNow(parseISO(item.submitted_at), { addSuffix: true })}
                              </div>
                            </div>

                            {item.comment && (
                              <div className="mt-3 p-3 bg-[#F9FAFB] rounded-lg">
                                <div className="text-xs font-medium text-[#667085] mb-1">Comment</div>
                                <p className="text-sm text-[#101E57]">{item.comment}</p>
                              </div>
                            )}

                            {item.topic_suggestion && (
                              <div className="mt-2 p-3 bg-[#EEF2FF] rounded-lg">
                                <div className="text-xs font-medium text-[#6F71EE] mb-1">Topic Suggestion</div>
                                <p className="text-sm text-[#101E57]">{item.topic_suggestion}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-[#667085]">
                  Failed to load feedback
                </div>
              )}
            </div>
          </div>
        )}
      </PageContainer>
    </>
  );
}
