'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, isPast } from 'date-fns';
import type { OHEvent, OHBooking, OHSlot } from '@/types';
import HubSpotContactCard from '@/components/HubSpotContactCard';

interface SlotWithBookings extends OHSlot {
  booking_count: number;
}

interface AttendeeStats {
  totalBookings: number;
  attended: number;
  noShows: number;
  noShowRate: number;
  isRepeatAttendee: boolean;
  isFrequentAttendee: boolean;
}

interface SessionTag {
  id: string;
  name: string;
  color: string;
}

interface QuickTask {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  completed_at: string | null;
  hubspot_task_id: string | null;
}

interface PrepResource {
  id: string;
  title: string;
  content: string;
  link: string | null;
}

interface SlotCardProps {
  slot: SlotWithBookings;
  event: OHEvent;
  bookings: OHBooking[];
  onDeleteSlot: (slotId: string) => void;
  onRefresh: () => void;
}

export default function SlotCard({
  slot,
  event,
  bookings,
  onDeleteSlot,
  onRefresh,
}: SlotCardProps) {
  const [recordingLink, setRecordingLink] = useState(slot.recording_link || '');
  const [savingRecording, setSavingRecording] = useState(false);
  const [attendeeStats, setAttendeeStats] = useState<Record<string, AttendeeStats>>({});
  const [showNotes, setShowNotes] = useState<string | null>(null);
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [notes, setNotes] = useState<Record<string, { id: string; note: string; created_at: string }[]>>({});
  const [savingNote, setSavingNote] = useState(false);
  const [showAttendees, setShowAttendees] = useState(false);
  const [expandedHubSpot, setExpandedHubSpot] = useState<string | null>(null);

  // Tags and tasks state
  const [allTags, setAllTags] = useState<SessionTag[]>([]);
  const [bookingTags, setBookingTags] = useState<SessionTag[]>([]);
  const [bookingTasks, setBookingTasks] = useState<QuickTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [savingTag, setSavingTag] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  // Quick actions state
  const [prepResources, setPrepResources] = useState<PrepResource[]>([]);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [sendingResource, setSendingResource] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [followupTitle, setFollowupTitle] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupNotes, setFollowupNotes] = useState('');
  const [syncFollowupToHubspot, setSyncFollowupToHubspot] = useState(true);
  const [schedulingFollowup, setSchedulingFollowup] = useState(false);

  // Bulk follow-up email state
  const [showBulkFollowup, setShowBulkFollowup] = useState(false);
  const [followupRecipients, setFollowupRecipients] = useState<'attended' | 'no_show'>('attended');
  const [followupSubject, setFollowupSubject] = useState('');
  const [followupBody, setFollowupBody] = useState('');
  const [sendingBulkFollowup, setSendingBulkFollowup] = useState(false);

  // Wrap-up session workflow state
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [markingAllAttendance, setMarkingAllAttendance] = useState(false);
  const [wrapUpAutoSynced, setWrapUpAutoSynced] = useState(false);
  const [syncingFromMeet, setSyncingFromMeet] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    attended: number;
    noShow: number;
    error?: string;
  } | null>(null);

  const isPastSlot = isPast(parseISO(slot.end_time));
  const capacityPercent = Math.round((slot.booking_count / event.max_attendees) * 100);

  // Auto-sync from Google Meet when wrap-up modal opens
  useEffect(() => {
    if (showWrapUp && !wrapUpAutoSynced && slot.google_meet_link) {
      const hasUnmarkedBookings = bookings.some(
        (b) => !b.cancelled_at && !b.attended_at && !b.no_show_at
      );
      if (hasUnmarkedBookings) {
        setWrapUpAutoSynced(true);
        handleSyncFromMeet();
      }
    }
  }, [showWrapUp]);

  // Reset auto-sync flag when modal closes
  useEffect(() => {
    if (!showWrapUp) {
      setWrapUpAutoSynced(false);
      setSyncResult(null);
    }
  }, [showWrapUp]);

  const handleMarkAttendance = async (
    bookingId: string,
    status: 'attended' | 'no_show' | 'clear',
    sendEmail = false
  ) => {
    try {
      await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          send_no_show_email: sendEmail,
        }),
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to update attendance:', err);
    }
  };

  const handleMarkAllAttendance = async (status: 'attended' | 'no_show') => {
    setMarkingAllAttendance(true);
    try {
      const unmarkedBookings = bookings.filter(
        (b) => !b.cancelled_at && !b.attended_at && !b.no_show_at
      );
      await Promise.all(
        unmarkedBookings.map((booking) =>
          fetch(`/api/bookings/${booking.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          })
        )
      );
      onRefresh();
    } catch (err) {
      console.error('Failed to mark all attendance:', err);
    } finally {
      setMarkingAllAttendance(false);
    }
  };

  const handleSyncFromMeet = async () => {
    if (!slot.google_meet_link) {
      setSyncResult({ success: false, attended: 0, noShow: 0, error: 'No Google Meet link for this session' });
      return;
    }

    setSyncingFromMeet(true);
    setSyncResult(null);

    try {
      const response = await fetch(`/api/slots/${slot.id}/sync-attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minDuration: 5 }), // 5 min minimum to count as attended
      });

      const data = await response.json();

      if (response.ok) {
        setSyncResult({
          success: true,
          attended: data.attended,
          noShow: data.noShow,
        });
        onRefresh();
      } else {
        setSyncResult({
          success: false,
          attended: 0,
          noShow: 0,
          error: data.error || 'Failed to sync attendance',
        });
      }
    } catch (err) {
      console.error('Failed to sync from Meet:', err);
      setSyncResult({
        success: false,
        attended: 0,
        noShow: 0,
        error: 'Network error syncing attendance',
      });
    } finally {
      setSyncingFromMeet(false);
    }
  };

  const handleSaveRecording = async () => {
    setSavingRecording(true);
    try {
      await fetch(`/api/slots/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_link: recordingLink }),
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to save recording:', err);
    } finally {
      setSavingRecording(false);
    }
  };

  const fetchAttendeeStats = async (email: string) => {
    if (attendeeStats[email]) return;
    try {
      const response = await fetch(`/api/attendees/${encodeURIComponent(email)}`);
      const data = await response.json();
      setAttendeeStats((prev) => ({ ...prev, [email]: data.stats }));
    } catch (err) {
      console.error('Failed to fetch attendee stats:', err);
    }
  };

  const fetchNotes = async (email: string) => {
    try {
      const response = await fetch(`/api/attendee-notes?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      setNotes((prev) => ({ ...prev, [email]: data }));
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  };

  const handleAddNote = async (email: string) => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await fetch('/api/attendee-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendee_email: email,
          note: newNote,
        }),
      });
      setNewNote('');
      fetchNotes(email);
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const openNotesPanel = (email: string, bookingId: string) => {
    setShowNotes(email);
    setCurrentBookingId(bookingId);
    fetchNotes(email);
    fetchAttendeeStats(email);
    fetchBookingTags(bookingId);
    fetchBookingTasks(bookingId);
  };

  // Fetch all available session tags on mount
  useEffect(() => {
    const fetchAllTags = async () => {
      try {
        const response = await fetch('/api/session-tags');
        if (response.ok) {
          const data = await response.json();
          setAllTags(data);
        }
      } catch (err) {
        console.error('Failed to fetch tags:', err);
      }
    };
    fetchAllTags();
  }, []);

  // Fetch prep resources for this event
  useEffect(() => {
    const fetchResources = async () => {
      try {
        const response = await fetch(`/api/events/${event.id}/resources`);
        if (response.ok) {
          const data = await response.json();
          setPrepResources(data);
        }
      } catch (err) {
        console.error('Failed to fetch resources:', err);
      }
    };
    if (event.id) {
      fetchResources();
    }
  }, [event.id]);

  const fetchBookingTags = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/tags`);
      if (response.ok) {
        const data = await response.json();
        setBookingTags(data);
      }
    } catch (err) {
      console.error('Failed to fetch booking tags:', err);
    }
  };

  const fetchBookingTasks = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/tasks`);
      if (response.ok) {
        const data = await response.json();
        setBookingTasks(data);
      }
    } catch (err) {
      console.error('Failed to fetch booking tasks:', err);
    }
  };

  const handleToggleTag = async (tagId: string) => {
    if (!currentBookingId) return;
    setSavingTag(true);

    const isApplied = bookingTags.some((t) => t.id === tagId);

    try {
      if (isApplied) {
        await fetch(`/api/bookings/${currentBookingId}/tags?tagId=${tagId}`, {
          method: 'DELETE',
        });
        setBookingTags((prev) => prev.filter((t) => t.id !== tagId));
      } else {
        const response = await fetch(`/api/bookings/${currentBookingId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag_id: tagId }),
        });
        if (response.ok) {
          const tag = await response.json();
          setBookingTags((prev) => [...prev, tag]);
        }
      }
    } catch (err) {
      console.error('Failed to toggle tag:', err);
    } finally {
      setSavingTag(false);
    }
  };

  const handleAddTask = async () => {
    if (!currentBookingId || !newTaskTitle.trim()) return;
    setSavingTask(true);

    try {
      const response = await fetch(`/api/bookings/${currentBookingId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          sync_to_hubspot: true,
        }),
      });
      if (response.ok) {
        const task = await response.json();
        setBookingTasks((prev) => [task, ...prev]);
        setNewTaskTitle('');
      }
    } catch (err) {
      console.error('Failed to add task:', err);
    } finally {
      setSavingTask(false);
    }
  };

  const handleToggleTaskComplete = async (taskId: string, completed: boolean) => {
    if (!currentBookingId) return;

    try {
      await fetch(`/api/bookings/${currentBookingId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, completed }),
      });
      setBookingTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, completed_at: completed ? new Date().toISOString() : null }
            : t
        )
      );
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const handleSendResource = async () => {
    if (!currentBookingId || !selectedResource) return;
    setSendingResource(true);

    try {
      const response = await fetch(`/api/bookings/${currentBookingId}/send-resource`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: selectedResource,
          customMessage: customMessage.trim() || undefined,
        }),
      });

      if (response.ok) {
        setShowResourceModal(false);
        setSelectedResource(null);
        setCustomMessage('');
        alert('Resource sent successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to send resource');
      }
    } catch (err) {
      console.error('Failed to send resource:', err);
      alert('Failed to send resource');
    } finally {
      setSendingResource(false);
    }
  };

  const openBulkFollowup = (recipients: 'attended' | 'no_show') => {
    setFollowupRecipients(recipients);
    const defaultSubject = recipients === 'attended'
      ? `Thanks for attending: ${event.name}`
      : `We missed you at ${event.name}`;
    const defaultBody = recipients === 'attended'
      ? `Hi there,\n\nThank you for attending ${event.name}!${recordingLink ? `\n\nHere's the recording from our session:\n${recordingLink}` : ''}\n\nLet us know if you have any questions.\n\nBest,\n${event.host_name}`
      : `Hi there,\n\nWe noticed you weren't able to make it to ${event.name}. No worries - life happens!\n\nIf you'd like to reschedule for another time, you can do so from your booking confirmation email.\n\nHope to see you soon!\n\n${event.host_name}`;
    setFollowupSubject(defaultSubject);
    setFollowupBody(defaultBody);
    setShowBulkFollowup(true);
  };

  const handleSendBulkFollowup = async () => {
    if (!followupSubject.trim() || !followupBody.trim()) return;
    setSendingBulkFollowup(true);

    try {
      const response = await fetch(`/api/slots/${slot.id}/send-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: followupRecipients,
          subject: followupSubject,
          body: followupBody,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Follow-up sent to ${result.sent} recipient(s)!`);
        setShowBulkFollowup(false);
        setFollowupSubject('');
        setFollowupBody('');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to send follow-up');
      }
    } catch (err) {
      console.error('Failed to send bulk follow-up:', err);
      alert('Failed to send follow-up');
    } finally {
      setSendingBulkFollowup(false);
    }
  };

  const handleScheduleFollowup = async () => {
    if (!currentBookingId || !followupTitle.trim()) return;
    setSchedulingFollowup(true);

    try {
      const response = await fetch(`/api/bookings/${currentBookingId}/schedule-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: followupTitle,
          dueDate: followupDate || undefined,
          notes: followupNotes.trim() || undefined,
          syncToHubspot: syncFollowupToHubspot,
        }),
      });

      if (response.ok) {
        const { task } = await response.json();
        setBookingTasks((prev) => [task, ...prev]);
        setShowFollowupModal(false);
        setFollowupTitle('');
        setFollowupDate('');
        setFollowupNotes('');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to schedule follow-up');
      }
    } catch (err) {
      console.error('Failed to schedule follow-up:', err);
      alert('Failed to schedule follow-up');
    } finally {
      setSchedulingFollowup(false);
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${isPastSlot ? 'border-gray-200 bg-gray-50' : 'border-gray-200'}`}>
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <p className="font-medium text-[#101E57]">
                {format(parseISO(slot.start_time), 'EEEE, MMMM d, yyyy')}
              </p>
              {isPastSlot && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-600">
                  Past
                </span>
              )}
              {!isPastSlot && capacityPercent >= 100 && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                  Full
                </span>
              )}
            </div>
            <p className="text-[#667085]">
              {format(parseISO(slot.start_time), 'h:mm a')} –{' '}
              {format(parseISO(slot.end_time), 'h:mm a')}
            </p>

            {/* Capacity Progress Bar */}
            <div className="mt-3 max-w-xs">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#667085]">
                  {slot.booking_count} / {event.max_attendees} booked
                </span>
                <span className={`font-medium ${
                  capacityPercent >= 100 ? 'text-red-600' :
                  capacityPercent >= 80 ? 'text-amber-600' :
                  capacityPercent > 0 ? 'text-[#417762]' : 'text-gray-400'
                }`}>
                  {capacityPercent}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    capacityPercent >= 100 ? 'bg-red-500' :
                    capacityPercent >= 80 ? 'bg-amber-500' :
                    capacityPercent > 0 ? 'bg-[#6F71EE]' : 'bg-gray-200'
                  }`}
                  style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                />
              </div>
            </div>

            {slot.google_meet_link && (
              <a
                href={slot.google_meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm text-[#6F71EE] hover:underline font-medium"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                Google Meet
              </a>
            )}
          </div>

          <div className="flex gap-2">
            {slot.booking_count > 0 && (
              <a
                href={`/api/slots/${slot.id}/export`}
                className="text-[#417762] hover:text-[#355f4f] text-sm font-medium"
              >
                Export
              </a>
            )}
            {!isPastSlot && (
              <button
                onClick={() => onDeleteSlot(slot.id)}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Post-Session Actions (for past slots) */}
      {isPastSlot && bookings && bookings.length > 0 && (
        <div className="px-4 pb-4">
          <div className="pt-4 border-t border-gray-100">
            {/* Quick status summary */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-[#417762]">
                  {bookings.filter(b => b.attended_at).length} attended
                </span>
                <span className="text-amber-600">
                  {bookings.filter(b => b.no_show_at).length} no-shows
                </span>
                {bookings.some(b => !b.cancelled_at && !b.attended_at && !b.no_show_at) && (
                  <span className="text-[#667085]">
                    {bookings.filter(b => !b.cancelled_at && !b.attended_at && !b.no_show_at).length} unmarked
                  </span>
                )}
              </div>
              {slot.recording_link && (
                <span className="text-xs text-[#667085] flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Recording saved
                </span>
              )}
            </div>

            {/* Wrap Up Session button */}
            <button
              onClick={() => {
                setShowWrapUp(true);
              }}
              className="w-full py-3 px-4 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Wrap Up Session
            </button>
            <p className="text-xs text-[#667085] mt-2 text-center">
              Mark attendance, add recording, and send follow-up emails
            </p>
          </div>
        </div>
      )}

      {/* Collapsible Attendees Section */}
      {bookings && bookings.length > 0 && (
        <div className="border-t border-gray-200">
          <button
            onClick={() => setShowAttendees(!showAttendees)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition"
          >
            <span className="text-sm font-medium text-[#101E57]">
              {bookings.length} Attendee{bookings.length !== 1 ? 's' : ''}
              {isPastSlot && (
                <span className="ml-2 text-[#667085] font-normal">
                  ({bookings.filter(b => b.attended_at).length} attended)
                </span>
              )}
            </span>
            <svg
              className={`w-5 h-5 text-[#667085] transition-transform ${showAttendees ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAttendees && (
            <div className="px-4 pb-4 space-y-2">
              {bookings.map((booking) => {
              const stats = attendeeStats[booking.email];
              const isHubSpotExpanded = expandedHubSpot === booking.email;
              return (
                <div key={booking.id} className="bg-[#F6F6F9] p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm text-[#101E57] font-medium">
                          {booking.first_name} {booking.last_name}
                          {stats?.isFrequentAttendee && (
                            <span className="ml-2 px-2 py-0.5 bg-[#417762]/20 text-[#417762] text-xs rounded-full">
                              Frequent
                            </span>
                          )}
                          {stats?.isRepeatAttendee && !stats?.isFrequentAttendee && (
                            <span className="ml-2 px-2 py-0.5 bg-[#6F71EE]/20 text-[#6F71EE] text-xs rounded-full">
                              Returning
                            </span>
                          )}
                          {stats && stats.noShowRate > 30 && (
                            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                              {stats.noShowRate}% no-show
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#667085]">{booking.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Attendance status */}
                      {isPastSlot && (
                        <div className="flex gap-1">
                          {booking.attended_at ? (
                            <span className="px-2 py-1 bg-[#417762]/20 text-[#417762] text-xs rounded font-medium">
                              Attended
                            </span>
                          ) : booking.no_show_at ? (
                            <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded font-medium">
                              No-show
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleMarkAttendance(booking.id, 'attended')}
                                className="px-2 py-1 bg-[#417762] text-white text-xs rounded hover:bg-[#355f4f]"
                              >
                                Attended
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Mark as no-show and send "we missed you" email?')) {
                                    handleMarkAttendance(booking.id, 'no_show', true);
                                  } else {
                                    handleMarkAttendance(booking.id, 'no_show', false);
                                  }
                                }}
                                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                              >
                                No-show
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* HubSpot Context button */}
                      <HubSpotContactCard
                        email={booking.email}
                        expanded={isHubSpotExpanded}
                        onToggle={() =>
                          setExpandedHubSpot(isHubSpotExpanded ? null : booking.email)
                        }
                      />

                      {/* Notes button */}
                      <button
                        onClick={() => openNotesPanel(booking.email, booking.id)}
                        onMouseEnter={() => fetchAttendeeStats(booking.email)}
                        className="px-2 py-1 text-[#6F71EE] hover:text-[#5a5cd0] text-xs font-medium"
                      >
                        Session
                      </button>

                      {/* Feedback rating if submitted */}
                      {booking.feedback_rating && (
                        <span className="text-[#F4B03D] text-sm">
                          {'★'.repeat(booking.feedback_rating)}
                          {'☆'.repeat(5 - booking.feedback_rating)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expandable HubSpot card (inside the row) */}
                  {isHubSpotExpanded && (
                    <HubSpotContactCard
                      email={booking.email}
                      expanded={true}
                      onToggle={() => setExpandedHubSpot(null)}
                    />
                  )}
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* Session Panel - Notes, Tags, Tasks */}
      {showNotes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-[#101E57]">Session Details - {showNotes}</h3>
              <button
                onClick={() => {
                  setShowNotes(null);
                  setCurrentBookingId(null);
                  setBookingTags([]);
                  setBookingTasks([]);
                }}
                className="text-[#667085] hover:text-[#101E57]"
              >
                ✕
              </button>
            </div>

            {/* Attendee Stats */}
            {attendeeStats[showNotes] && (
              <div className="p-4 bg-[#F6F6F9] border-b">
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <p className="text-[#667085]">Total Bookings</p>
                    <p className="font-semibold text-[#101E57]">
                      {attendeeStats[showNotes].totalBookings}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#667085]">Attended</p>
                    <p className="font-semibold text-[#417762]">
                      {attendeeStats[showNotes].attended}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#667085]">No-shows</p>
                    <p className="font-semibold text-red-600">
                      {attendeeStats[showNotes].noShows}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {/* Outcome Tags Section */}
              <div className="p-4 border-b">
                <h4 className="text-sm font-medium text-[#101E57] mb-3">Session Outcome</h4>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => {
                    const isApplied = bookingTags.some((t) => t.id === tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleToggleTag(tag.id)}
                        disabled={savingTag}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                          isApplied
                            ? 'ring-2 ring-offset-1'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                          ...(isApplied ? { ringColor: tag.color } : {}),
                        }}
                      >
                        {isApplied && '✓ '}
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Tasks Section */}
              <div className="p-4 border-b">
                <h4 className="text-sm font-medium text-[#101E57] mb-3">Follow-up Tasks</h4>

                {/* Add task input */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Add a task (syncs to HubSpot)..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !savingTask) {
                        handleAddTask();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddTask}
                    disabled={savingTask || !newTaskTitle.trim()}
                    className="px-4 py-2 bg-[#6F71EE] text-white text-sm rounded-lg hover:bg-[#5a5cd0] disabled:opacity-50"
                  >
                    {savingTask ? '...' : 'Add'}
                  </button>
                </div>

                {/* Task list */}
                {bookingTasks.length === 0 ? (
                  <p className="text-sm text-[#667085]">No tasks yet.</p>
                ) : (
                  <div className="space-y-2">
                    {bookingTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 p-2 rounded-lg ${
                          task.completed_at ? 'bg-gray-50' : 'bg-[#F6F6F9]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!task.completed_at}
                          onChange={(e) =>
                            handleToggleTaskComplete(task.id, e.target.checked)
                          }
                          className="w-4 h-4 rounded border-gray-300 text-[#6F71EE] focus:ring-[#6F71EE]"
                        />
                        <span
                          className={`flex-1 text-sm ${
                            task.completed_at
                              ? 'text-[#667085] line-through'
                              : 'text-[#101E57]'
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.hubspot_task_id && (
                          <span className="text-xs text-[#667085]">HubSpot</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions Section */}
              <div className="p-4 border-b">
                <h4 className="text-sm font-medium text-[#101E57] mb-3">Quick Actions</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowResourceModal(true)}
                    disabled={prepResources.length === 0}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-[#F6F6F9] hover:bg-gray-200 text-[#101E57] rounded-lg transition disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Send Help Article
                  </button>
                  <button
                    onClick={() => setShowFollowupModal(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-[#F6F6F9] hover:bg-gray-200 text-[#101E57] rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Schedule Follow-up
                  </button>
                </div>
              </div>

              {/* Notes Section */}
              <div className="p-4">
                <h4 className="text-sm font-medium text-[#101E57] mb-3">Session Notes</h4>
                {notes[showNotes]?.length === 0 && (
                  <p className="text-[#667085] text-sm mb-3">No notes yet.</p>
                )}
                {notes[showNotes]?.map((note) => (
                  <div key={note.id} className="mb-3 p-3 bg-[#F6F6F9] rounded-lg">
                    <p className="text-sm text-[#101E57]">{note.note}</p>
                    <p className="text-xs text-[#667085] mt-1">
                      {format(parseISO(note.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Note Input */}
            <div className="p-4 border-t bg-white">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              />
              <button
                onClick={() => handleAddNote(showNotes)}
                disabled={savingNote || !newNote.trim()}
                className="mt-2 px-4 py-2 bg-[#6F71EE] text-white text-sm rounded-lg hover:bg-[#5a5cd0] disabled:opacity-50"
              >
                {savingNote ? 'Saving...' : 'Add Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Resource Modal */}
      {showResourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-[#101E57]">Send Help Article</h3>
              <button
                onClick={() => {
                  setShowResourceModal(false);
                  setSelectedResource(null);
                  setCustomMessage('');
                }}
                className="text-[#667085] hover:text-[#101E57]"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Select Resource
                </label>
                <select
                  value={selectedResource || ''}
                  onChange={(e) => setSelectedResource(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                >
                  <option value="">Choose a resource...</option>
                  {prepResources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Add a message (optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add a personal note..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowResourceModal(false);
                  setSelectedResource(null);
                  setCustomMessage('');
                }}
                className="px-4 py-2 text-sm text-[#667085] hover:text-[#101E57]"
              >
                Cancel
              </button>
              <button
                onClick={handleSendResource}
                disabled={sendingResource || !selectedResource}
                className="px-4 py-2 bg-[#6F71EE] text-white text-sm rounded-lg hover:bg-[#5a5cd0] disabled:opacity-50"
              >
                {sendingResource ? 'Sending...' : 'Send Resource'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Follow-up Modal */}
      {showFollowupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-[#101E57]">Schedule Follow-up</h3>
              <button
                onClick={() => {
                  setShowFollowupModal(false);
                  setFollowupTitle('');
                  setFollowupDate('');
                  setFollowupNotes('');
                }}
                className="text-[#667085] hover:text-[#101E57]"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Follow-up Task
                </label>
                <input
                  type="text"
                  value={followupTitle}
                  onChange={(e) => setFollowupTitle(e.target.value)}
                  placeholder="e.g., Check in on store setup progress"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Due Date (optional)
                </label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={followupNotes}
                  onChange={(e) => setFollowupNotes(e.target.value)}
                  placeholder="Any additional context..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="syncHubspot"
                  checked={syncFollowupToHubspot}
                  onChange={(e) => setSyncFollowupToHubspot(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#6F71EE] focus:ring-[#6F71EE]"
                />
                <label htmlFor="syncHubspot" className="text-sm text-[#667085]">
                  Also create task in HubSpot
                </label>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowFollowupModal(false);
                  setFollowupTitle('');
                  setFollowupDate('');
                  setFollowupNotes('');
                }}
                className="px-4 py-2 text-sm text-[#667085] hover:text-[#101E57]"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleFollowup}
                disabled={schedulingFollowup || !followupTitle.trim()}
                className="px-4 py-2 bg-[#6F71EE] text-white text-sm rounded-lg hover:bg-[#5a5cd0] disabled:opacity-50"
              >
                {schedulingFollowup ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Follow-up Email Modal */}
      {showBulkFollowup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-[#101E57]">
                {followupRecipients === 'attended'
                  ? 'Email Attendees'
                  : 'Email No-Shows'}
              </h3>
              <button
                onClick={() => {
                  setShowBulkFollowup(false);
                  setFollowupSubject('');
                  setFollowupBody('');
                }}
                className="text-[#667085] hover:text-[#101E57]"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              <div className="p-3 rounded-lg bg-[#F6F6F9]">
                <p className="text-sm text-[#667085]">
                  Sending to {followupRecipients === 'attended'
                    ? bookings?.filter(b => b.attended_at).length
                    : bookings?.filter(b => b.no_show_at).length} recipient(s)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={followupSubject}
                  onChange={(e) => setFollowupSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Message
                </label>
                <textarea
                  value={followupBody}
                  onChange={(e) => setFollowupBody(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] font-mono"
                />
                <p className="text-xs text-[#667085] mt-1">
                  {followupRecipients === 'attended' && recordingLink && (
                    <>Recording link included. </>
                  )}
                  Line breaks will be preserved in the email.
                </p>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowBulkFollowup(false);
                  setFollowupSubject('');
                  setFollowupBody('');
                }}
                className="px-4 py-2 text-sm text-[#667085] hover:text-[#101E57]"
              >
                Cancel
              </button>
              <button
                onClick={handleSendBulkFollowup}
                disabled={sendingBulkFollowup || !followupSubject.trim() || !followupBody.trim()}
                className="px-4 py-2 bg-[#6F71EE] text-white text-sm rounded-lg hover:bg-[#5a5cd0] disabled:opacity-50"
              >
                {sendingBulkFollowup ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wrap Up Session Modal - Streamlined Single View */}
      {showWrapUp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[#101E57] text-lg">Wrap Up Session</h3>
                <p className="text-sm text-[#667085]">
                  {format(parseISO(slot.start_time), 'MMM d, h:mm a')} · {event.name}
                </p>
              </div>
              <button
                onClick={() => setShowWrapUp(false)}
                className="text-[#667085] hover:text-[#101E57] p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* All sections in single view */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Section 1: Attendance */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📋</span>
                    <span className="font-medium text-[#101E57]">Attendance</span>
                  </div>
                  {syncingFromMeet ? (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Syncing from Meet...
                    </span>
                  ) : syncResult?.success ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Synced from Meet
                    </span>
                  ) : syncResult?.error ? (
                    <span className="text-xs text-red-600">{syncResult.error}</span>
                  ) : null}
                </div>
                <div className="p-4 space-y-3">
                  {/* Attendee list */}
                  {bookings.filter(b => !b.cancelled_at).map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-2 bg-[#F6F6F9] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                          booking.attended_at
                            ? 'bg-[#417762] text-white'
                            : booking.no_show_at
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-300 text-gray-600'
                        }`}>
                          {booking.attended_at ? '✓' : booking.no_show_at ? '✗' : '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#101E57]">
                            {booking.first_name} {booking.last_name}
                          </p>
                          <p className="text-xs text-[#667085]">{booking.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {booking.attended_at ? (
                          <span className="px-2 py-1 bg-[#417762]/20 text-[#417762] text-xs rounded font-medium">
                            Attended
                          </span>
                        ) : booking.no_show_at ? (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                            No-show
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleMarkAttendance(booking.id, 'attended')}
                              className="px-2 py-1 bg-[#417762] text-white text-xs rounded hover:bg-[#355f4f]"
                            >
                              Attended
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(booking.id, 'no_show')}
                              className="px-2 py-1 bg-amber-500 text-white text-xs rounded hover:bg-amber-600"
                            >
                              No-show
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Summary and actions row */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="text-xs text-[#667085]">
                      <span className="text-[#417762] font-medium">{bookings.filter(b => b.attended_at).length}</span> attended ·
                      <span className="text-amber-600 font-medium ml-1">{bookings.filter(b => b.no_show_at).length}</span> no-show ·
                      <span className="text-[#101E57] font-medium ml-1">{bookings.filter(b => !b.cancelled_at && !b.attended_at && !b.no_show_at).length}</span> unmarked
                    </div>
                    {slot.google_meet_link && (
                      <button
                        onClick={handleSyncFromMeet}
                        disabled={syncingFromMeet}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Re-sync from Meet
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Recording */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎬</span>
                    <span className="font-medium text-[#101E57]">Recording</span>
                  </div>
                  {slot.recording_link ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Saved
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">Not added yet</span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={recordingLink}
                      onChange={(e) => setRecordingLink(e.target.value)}
                      placeholder="https://app.fireflies.ai/view/..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                    <button
                      onClick={handleSaveRecording}
                      disabled={savingRecording || !recordingLink || recordingLink === slot.recording_link}
                      className="px-4 py-2 bg-[#6F71EE] text-white text-sm rounded-lg hover:bg-[#5a5cd0] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingRecording ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <p className="text-xs text-[#667085] mt-2">
                    Paste link from Fireflies, Loom, or other recording service. Will be included in follow-up emails.
                  </p>
                </div>
              </div>

              {/* Section 3: Follow-ups */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📧</span>
                    <span className="font-medium text-[#101E57]">Follow-ups</span>
                  </div>
                  <span className="text-xs text-[#667085]">Optional</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        openBulkFollowup('attended');
                        setShowWrapUp(false);
                      }}
                      disabled={!bookings.some(b => b.attended_at)}
                      className="p-3 border border-gray-200 rounded-lg hover:border-[#417762] hover:bg-[#417762]/5 disabled:opacity-50 disabled:cursor-not-allowed text-left transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-[#417762]/20 flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#417762]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-[#101E57]">Thank You Email</span>
                      </div>
                      <p className="text-xs text-[#667085]">
                        {bookings.filter(b => b.attended_at).length} attendees
                      </p>
                    </button>

                    <button
                      onClick={() => {
                        openBulkFollowup('no_show');
                        setShowWrapUp(false);
                      }}
                      disabled={!bookings.some(b => b.no_show_at)}
                      className="p-3 border border-gray-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed text-left transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                          <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-[#101E57]">We Missed You</span>
                      </div>
                      <p className="text-xs text-[#667085]">
                        {bookings.filter(b => b.no_show_at).length} no-shows
                      </p>
                    </button>
                  </div>

                  <p className="text-xs text-[#667085] text-center">
                    Auto follow-up emails will be sent in ~2 hours if not sent manually.
                  </p>
                </div>
              </div>
            </div>

            {/* Simple footer */}
            <div className="p-4 border-t">
              <button
                onClick={() => setShowWrapUp(false)}
                className="w-full py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
