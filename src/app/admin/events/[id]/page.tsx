'use client';

import { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format, addMinutes, parseISO, addDays, addWeeks, startOfDay, isBefore, isPast } from 'date-fns';
import type { OHEvent, OHSlot, OHBooking } from '@/types';
import SlotCard from './SlotCard';
import Breadcrumb from '@/components/Breadcrumb';
import DayTimeline from '@/components/DayTimeline';
import WeekCalendar from '@/components/WeekCalendar';

interface SlotWithBookings extends OHSlot {
  booking_count: number;
}

type SlotCreationMode = 'single' | 'bulk' | 'recurring' | 'calendar';

export default function ManageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [event, setEvent] = useState<OHEvent | null>(null);
  const [slots, setSlots] = useState<SlotWithBookings[]>([]);
  const [bookings, setBookings] = useState<Record<string, OHBooking[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Slot creation mode
  const [creationMode, setCreationMode] = useState<SlotCreationMode>('calendar');

  // Single slot form
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('10:00');

  // Bulk slot form
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [bulkTime, setBulkTime] = useState('10:00');
  const [bulkDays, setBulkDays] = useState<number[]>([]);

  // Recurring slot form
  const [recurringStartDate, setRecurringStartDate] = useState('');
  const [recurringTime, setRecurringTime] = useState('10:00');
  const [recurringWeeks, setRecurringWeeks] = useState(4);

  const [addingSlot, setAddingSlot] = useState(false);
  const [slotsToCreate, setSlotsToCreate] = useState<Date[]>([]);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);

  const slotsRef = useRef<HTMLDivElement>(null);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const scrollToAddSlots = () => {
    slotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Preview slots to be created
  useEffect(() => {
    if (!event) return;

    const preview: Date[] = [];
    const today = startOfDay(new Date());

    if (creationMode === 'bulk' && bulkStartDate && bulkEndDate && bulkDays.length > 0) {
      let current = parseISO(bulkStartDate);
      const end = parseISO(bulkEndDate);

      while (!isBefore(end, current)) {
        if (bulkDays.includes(current.getDay())) {
          const [hours, minutes] = bulkTime.split(':').map(Number);
          const slotTime = new Date(current);
          slotTime.setHours(hours, minutes, 0, 0);
          if (!isBefore(slotTime, today)) {
            preview.push(slotTime);
          }
        }
        current = addDays(current, 1);
      }
    } else if (creationMode === 'recurring' && recurringStartDate) {
      const [hours, minutes] = recurringTime.split(':').map(Number);
      for (let i = 0; i < recurringWeeks; i++) {
        const slotTime = addWeeks(parseISO(recurringStartDate), i);
        slotTime.setHours(hours, minutes, 0, 0);
        if (!isBefore(slotTime, today)) {
          preview.push(slotTime);
        }
      }
    }

    setSlotsToCreate(preview);
  }, [creationMode, bulkStartDate, bulkEndDate, bulkTime, bulkDays, recurringStartDate, recurringTime, recurringWeeks, event]);

  const fetchData = async () => {
    try {
      const [eventRes, slotsRes] = await Promise.all([
        fetch(`/api/events/${id}`),
        fetch(`/api/slots?eventId=${id}`),
      ]);

      if (!eventRes.ok) throw new Error('Event not found');

      const eventData = await eventRes.json();
      const slotsData = await slotsRes.json();

      setEvent(eventData);
      setSlots(slotsData);

      // Fetch bookings for each slot
      const bookingsData: Record<string, OHBooking[]> = {};
      for (const slot of slotsData) {
        const bookingsRes = await fetch(`/api/bookings?slotId=${slot.id}`);
        if (bookingsRes.ok) {
          bookingsData[slot.id] = await bookingsRes.json();
        }
      }
      setBookings(bookingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const createSlot = async (startTime: Date) => {
    if (!event) return;
    const endTime = addMinutes(startTime, event.duration_minutes);

    const response = await fetch('/api/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to add slot');
    }
  };

  const handleAddSingleSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !newSlotDate || !newSlotTime) return;

    setAddingSlot(true);
    setError('');

    try {
      const startTime = new Date(`${newSlotDate}T${newSlotTime}:00`);
      await createSlot(startTime);
      await fetchData();
      setNewSlotDate('');
      setNewSlotTime('10:00');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add slot');
    } finally {
      setAddingSlot(false);
    }
  };

  const handleAddBulkSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slotsToCreate.length === 0) return;

    setAddingSlot(true);
    setError('');

    try {
      for (const slotTime of slotsToCreate) {
        await createSlot(slotTime);
      }
      await fetchData();
      setBulkStartDate('');
      setBulkEndDate('');
      setBulkDays([]);
      setSlotsToCreate([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add slots');
    } finally {
      setAddingSlot(false);
    }
  };

  const handleAddRecurringSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slotsToCreate.length === 0) return;

    setAddingSlot(true);
    setError('');

    try {
      for (const slotTime of slotsToCreate) {
        await createSlot(slotTime);
      }
      await fetchData();
      setRecurringStartDate('');
      setRecurringWeeks(4);
      setSlotsToCreate([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add slots');
    } finally {
      setAddingSlot(false);
    }
  };

  const toggleBulkDay = (day: number) => {
    setBulkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to cancel this time slot?')) return;

    try {
      const response = await fetch(`/api/slots/${slotId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel slot');
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel slot');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <p className="text-[#667085]">Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <p className="text-[#667085]">Event not found</p>
      </div>
    );
  }

  // Calculate quick stats
  const upcomingSlots = slots.filter(s => !isPast(parseISO(s.end_time)));
  const totalBookings = upcomingSlots.reduce((sum, s) => sum + (s.booking_count || 0), 0);
  const totalCapacity = upcomingSlots.length * event.max_attendees;

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
                alt="LiveSchool"
                width={120}
                height={32}
              />
              <Breadcrumb
                items={[
                  { label: 'Dashboard', href: '/admin' },
                  { label: event.name },
                ]}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Primary Action Bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              {/* Quick Stats */}
              <div className="flex items-center gap-4 text-sm">
                <span className="text-[#667085]">
                  <span className="font-semibold text-[#101E57]">{upcomingSlots.length}</span> upcoming slot{upcomingSlots.length !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-[#667085]">
                  <span className="font-semibold text-[#101E57]">{totalBookings}</span> / {totalCapacity} booked
                </span>
              </div>
            </div>

            {/* Primary Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={scrollToAddSlots}
                className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Time Slots
              </button>
              <a
                href={`${process.env.NEXT_PUBLIC_APP_URL || ''}/book/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-[#6F71EE] border border-[#6F71EE] px-4 py-2 rounded-lg hover:bg-[#6F71EE]/5 transition font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Public Page
              </a>
              <div className="relative group">
                <button className="text-[#667085] hover:text-[#101E57] p-2 rounded-lg hover:bg-gray-100 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                {/* More Actions Dropdown */}
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <Link
                    href={`/admin/events/${id}/settings`}
                    className="block px-4 py-2 text-sm text-[#101E57] hover:bg-gray-50"
                  >
                    Edit Settings
                  </Link>
                  <Link
                    href={`/admin/events/${id}/emails`}
                    className="block px-4 py-2 text-sm text-[#101E57] hover:bg-gray-50"
                  >
                    Email Templates
                  </Link>
                  <Link
                    href={`/admin/events/${id}/embed`}
                    className="block px-4 py-2 text-sm text-[#101E57] hover:bg-gray-50"
                  >
                    Embed on Website
                  </Link>
                  <a
                    href={`/api/events/${id}/export`}
                    className="block px-4 py-2 text-sm text-[#101E57] hover:bg-gray-50"
                  >
                    Export Bookings (CSV)
                  </a>
                  <Link
                    href="/admin/analytics"
                    className="block px-4 py-2 text-sm text-[#101E57] hover:bg-gray-50"
                  >
                    Topic Analytics
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded mb-6 text-sm">{error}</div>
        )}

        {/* Event Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#101E57]">{event.name}</h1>
              <p className="text-[#667085] mt-1">
                {event.duration_minutes} min · {event.host_name} · Max {event.max_attendees} attendees
              </p>
              {event.description && (
                <div
                  className="prose prose-sm max-w-none text-[#667085] mt-3 [&_a]:text-[#6F71EE] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1 [&_p]:my-2 [&_strong]:text-[#101E57] [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: event.description }}
                />
              )}
            </div>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
              upcomingSlots.length === 0
                ? 'bg-amber-100 text-amber-700'
                : totalBookings >= totalCapacity
                ? 'bg-red-100 text-red-700'
                : 'bg-[#417762]/10 text-[#417762]'
            }`}>
              {upcomingSlots.length === 0
                ? 'No slots'
                : totalBookings >= totalCapacity
                ? 'Fully booked'
                : 'Active'}
            </span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-[#667085]">
              Public booking link:{' '}
              <a
                href={`${process.env.NEXT_PUBLIC_APP_URL || ''}/book/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#6F71EE] hover:underline font-medium"
              >
                {process.env.NEXT_PUBLIC_APP_URL || ''}/book/{event.slug}
              </a>
            </p>
          </div>
        </div>

        {/* Session Workflow Guide */}
        <div className="bg-gradient-to-r from-[#6F71EE]/5 to-[#417762]/5 rounded-lg border border-[#6F71EE]/20 mb-8 overflow-hidden">
          <button
            onClick={() => setShowWorkflowGuide(!showWorkflowGuide)}
            className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-white/50 transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🎯</span>
              <span className="font-medium text-[#101E57]">Session Workflow Guide</span>
              <span className="text-xs text-[#667085] bg-white/70 px-2 py-0.5 rounded-full">
                Before · During · After
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-[#667085] transition-transform ${showWorkflowGuide ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showWorkflowGuide && (
            <div className="px-5 pb-5 pt-2">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Before */}
                <div className="bg-white rounded-lg p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">1</span>
                    <h4 className="font-medium text-[#101E57]">Before Session</h4>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span className="text-[#667085]">
                        <Link href="/admin/analytics" className="text-[#6F71EE] hover:underline">Check Topics</Link> to see what attendees want to discuss
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span className="text-[#667085]">
                        Review attendee list below &mdash; look for new vs returning folks
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span className="text-[#667085]">
                        <Link href={`/admin/events/${id}/settings`} className="text-[#6F71EE] hover:underline">Check Prep Resources</Link> you want to share
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span className="text-[#667085]">
                        Reminders auto-send 24h and 1h before
                      </span>
                    </li>
                  </ul>
                </div>

                {/* During */}
                <div className="bg-white rounded-lg p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-semibold">2</span>
                    <h4 className="font-medium text-[#101E57]">During Session</h4>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      <span className="text-[#667085]">
                        Click <span className="font-medium text-[#101E57]">Join Google Meet</span> on the slot card below
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      <span className="text-[#667085]">
                        Google Meet auto-records (check your settings)
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      <span className="text-[#667085]">
                        Use <span className="font-medium text-[#101E57]">Session</span> button on attendees to add notes in real-time
                      </span>
                    </li>
                  </ul>
                </div>

                {/* After */}
                <div className="bg-white rounded-lg p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-sm font-semibold">3</span>
                    <h4 className="font-medium text-[#101E57]">After Session</h4>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span className="text-[#667085]">
                        Click <span className="font-medium text-[#101E57]">Wrap Up Session</span> on the slot card
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span className="text-[#667085]">
                        Attendance auto-syncs from Google Meet
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span className="text-[#667085]">
                        Add recording link from Fireflies/Loom
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span className="text-[#667085]">
                        Send follow-up emails or let automations handle it
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Quick tip */}
              <div className="mt-4 p-3 bg-[#6F71EE]/5 rounded-lg flex items-start gap-3">
                <span className="text-[#6F71EE]">💡</span>
                <p className="text-sm text-[#667085]">
                  <span className="font-medium text-[#101E57]">Pro tip:</span> The{' '}
                  <Link href="/admin" className="text-[#6F71EE] hover:underline">Events page</Link>{' '}
                  shows today&apos;s sessions at the top for a quick operational view.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Add Time Slots */}
        <div ref={slotsRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8 scroll-mt-4">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Add Time Slots</h2>

          {/* Mode Tabs */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setCreationMode('calendar')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                creationMode === 'calendar'
                  ? 'bg-[#6F71EE] text-white'
                  : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
              }`}
            >
              Calendar View
            </button>
            <button
              onClick={() => setCreationMode('single')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                creationMode === 'single'
                  ? 'bg-[#6F71EE] text-white'
                  : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
              }`}
            >
              Single Slot
            </button>
            <button
              onClick={() => setCreationMode('bulk')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                creationMode === 'bulk'
                  ? 'bg-[#6F71EE] text-white'
                  : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
              }`}
            >
              Bulk Create
            </button>
            <button
              onClick={() => setCreationMode('recurring')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                creationMode === 'recurring'
                  ? 'bg-[#6F71EE] text-white'
                  : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
              }`}
            >
              Weekly Recurring
            </button>
          </div>
          {/* Tab Helper Text */}
          <p className="text-sm text-[#667085] mb-6">
            {creationMode === 'calendar' && 'See your week at a glance and click to create slots'}
            {creationMode === 'single' && 'Add one specific date and time'}
            {creationMode === 'bulk' && 'Create multiple slots across a date range on selected days'}
            {creationMode === 'recurring' && 'Repeat on the same day each week'}
          </p>

          {/* Single Slot Form */}
          {creationMode === 'single' && (
            <div>
              <form onSubmit={handleAddSingleSlot} className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newSlotDate}
                    onChange={(e) => setNewSlotDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={newSlotTime}
                    onChange={(e) => setNewSlotTime(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingSlot || !newSlotDate || !newSlotTime}
                  className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
                >
                  {addingSlot ? 'Adding...' : 'Add Slot'}
                </button>
              </form>

              {/* Day Timeline - shows when date is selected */}
              <DayTimeline
                date={newSlotDate}
                eventId={id}
                selectedTime={newSlotTime}
                onSelectTime={(time) => setNewSlotTime(time)}
                slotDuration={event?.duration_minutes || 30}
              />
            </div>
          )}

          {/* Bulk Create Form */}
          {creationMode === 'bulk' && (
            <form onSubmit={handleAddBulkSlots}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={bulkStartDate}
                    onChange={(e) => setBulkStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={bulkEndDate}
                    onChange={(e) => setBulkEndDate(e.target.value)}
                    min={bulkStartDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Days of Week
                </label>
                <div className="flex flex-wrap gap-2">
                  {dayNames.map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleBulkDay(index)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition ${
                        bulkDays.includes(index)
                          ? 'bg-[#6F71EE] text-white'
                          : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  Time
                </label>
                <input
                  type="time"
                  required
                  value={bulkTime}
                  onChange={(e) => setBulkTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>

              {slotsToCreate.length > 0 && (
                <div className="mb-4 p-4 bg-[#F6F6F9] rounded-lg">
                  <p className="text-sm font-medium text-[#101E57] mb-2">
                    Preview: {slotsToCreate.length} slots will be created
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {slotsToCreate.map((slot, i) => (
                      <span
                        key={i}
                        className="text-xs bg-white px-2 py-1 rounded border border-gray-200 text-[#667085]"
                      >
                        {format(slot, 'EEE, MMM d')} at {format(slot, 'h:mm a')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={addingSlot || slotsToCreate.length === 0}
                className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
              >
                {addingSlot
                  ? 'Creating...'
                  : slotsToCreate.length === 0
                  ? 'Select dates to create slots'
                  : `Create ${slotsToCreate.length} Slot${slotsToCreate.length !== 1 ? 's' : ''}`}
              </button>
            </form>
          )}

          {/* Weekly Recurring Form */}
          {creationMode === 'recurring' && (
            <form onSubmit={handleAddRecurringSlots}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    First Session Date
                  </label>
                  <input
                    type="date"
                    required
                    value={recurringStartDate}
                    onChange={(e) => setRecurringStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={recurringTime}
                    onChange={(e) => setRecurringTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Number of Weeks
                  </label>
                  <select
                    value={recurringWeeks}
                    onChange={(e) => setRecurringWeeks(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  >
                    {[2, 4, 6, 8, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n} weeks
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {recurringStartDate && (
                <p className="text-sm text-[#667085] mb-4">
                  Every {format(parseISO(recurringStartDate), 'EEEE')} at {recurringTime} for {recurringWeeks} weeks
                </p>
              )}

              {slotsToCreate.length > 0 && (
                <div className="mb-4 p-4 bg-[#F6F6F9] rounded-lg">
                  <p className="text-sm font-medium text-[#101E57] mb-2">
                    Preview: {slotsToCreate.length} slots will be created
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {slotsToCreate.map((slot, i) => (
                      <span
                        key={i}
                        className="text-xs bg-white px-2 py-1 rounded border border-gray-200 text-[#667085]"
                      >
                        {format(slot, 'EEE, MMM d')} at {format(slot, 'h:mm a')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={addingSlot || slotsToCreate.length === 0}
                className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
              >
                {addingSlot
                  ? 'Creating...'
                  : slotsToCreate.length === 0
                  ? 'Select a start date'
                  : `Create ${slotsToCreate.length} Slot${slotsToCreate.length !== 1 ? 's' : ''}`}
              </button>
            </form>
          )}

          {/* Calendar View */}
          {creationMode === 'calendar' && (
            <WeekCalendar
              eventId={id}
              slotDuration={event?.duration_minutes || 30}
              onSlotCreate={async (date, time) => {
                const startTime = new Date(`${date}T${time}:00`);
                await createSlot(startTime);
                await fetchData();
              }}
              onSlotClick={(slotId) => {
                // Could navigate to slot details or show a modal
                const slot = slots.find(s => s.id === slotId);
                if (slot) {
                  // Just scroll to the slot in the list for now
                  document.getElementById(`slot-${slotId}`)?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            />
          )}

          {creationMode !== 'calendar' && (
            <p className="text-sm text-[#667085] mt-4">
              Each slot is {event.duration_minutes} minutes. Google Calendar events with Meet links will be created automatically.
            </p>
          )}
        </div>

        {/* Upcoming Slots */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Upcoming Time Slots</h2>

          {slots.filter(s => !isPast(parseISO(s.end_time))).length === 0 ? (
            <div className="text-center py-12 bg-[#F6F6F9] rounded-lg">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#101E57] mb-2">No upcoming sessions</h3>
              <p className="text-[#667085] mb-6 max-w-sm mx-auto">
                Create time slots above to start accepting bookings. Attendees will see available times on your public booking page.
              </p>
              <button
                onClick={scrollToAddSlots}
                className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Your First Time Slot
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {slots
                .filter(s => !isPast(parseISO(s.end_time)))
                .map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    event={event}
                    bookings={bookings[slot.id] || []}
                    onDeleteSlot={handleDeleteSlot}
                    onRefresh={fetchData}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Past Slots (with attendance tracking) */}
        {slots.filter(s => isPast(parseISO(s.end_time))).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-[#101E57] mb-4">Past Sessions</h2>
            <p className="text-sm text-[#667085] mb-4">
              Mark attendance and add recording links for past sessions.
            </p>
            <div className="space-y-4">
              {slots
                .filter(s => isPast(parseISO(s.end_time)))
                .slice(0, 10) // Show last 10
                .map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    event={event}
                    bookings={bookings[slot.id] || []}
                    onDeleteSlot={handleDeleteSlot}
                    onRefresh={fetchData}
                  />
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
