'use client';

import { useState } from 'react';
import { format, parseISO, isPast } from 'date-fns';
import type { OHEvent, OHBooking, OHSlot } from '@/types';

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
  const [newNote, setNewNote] = useState('');
  const [notes, setNotes] = useState<Record<string, { id: string; note: string; created_at: string }[]>>({});
  const [savingNote, setSavingNote] = useState(false);
  const [showAttendees, setShowAttendees] = useState(false);

  const isPastSlot = isPast(parseISO(slot.end_time));
  const capacityPercent = Math.round((slot.booking_count / event.max_attendees) * 100);

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

  const openNotesPanel = (email: string) => {
    setShowNotes(email);
    fetchNotes(email);
    fetchAttendeeStats(email);
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

      {/* Recording Link (for past slots) */}
      {isPastSlot && (
        <div className="px-4 pb-4">
          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium text-[#101E57] mb-2">
              Session Recording
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={recordingLink}
                onChange={(e) => setRecordingLink(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] bg-white"
              />
              <button
                onClick={handleSaveRecording}
                disabled={savingRecording}
                className="px-3 py-1.5 text-sm bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] disabled:opacity-50"
              >
                {savingRecording ? 'Saving...' : slot.recording_link ? 'Update' : 'Save'}
              </button>
            </div>
            {slot.recording_link && (
              <p className="text-xs text-[#667085] mt-1">
                Recording link saved. Attendees will be notified automatically.
              </p>
            )}
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
              return (
                <div key={booking.id} className="flex items-center justify-between bg-[#F6F6F9] p-3 rounded-lg">
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

                    {/* Notes button */}
                    <button
                      onClick={() => openNotesPanel(booking.email)}
                      onMouseEnter={() => fetchAttendeeStats(booking.email)}
                      className="px-2 py-1 text-[#667085] hover:text-[#101E57] text-xs"
                    >
                      Notes
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
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* Notes Panel */}
      {showNotes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-[#101E57]">Notes for {showNotes}</h3>
              <button
                onClick={() => setShowNotes(null)}
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

            <div className="p-4 overflow-y-auto max-h-60">
              {notes[showNotes]?.length === 0 && (
                <p className="text-[#667085] text-sm">No notes yet.</p>
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

            <div className="p-4 border-t">
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
    </div>
  );
}
