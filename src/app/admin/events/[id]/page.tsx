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
import QRCodeModal from '@/components/QRCodeModal';

interface SlotWithBookings extends OHSlot {
  booking_count: number;
}

type SlotCreationMode = 'single' | 'bulk' | 'recurring' | 'calendar' | 'copy_week' | 'import_csv';

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

  // Save as Template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // QR Code modal
  const [showQRModal, setShowQRModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSuccess, setTemplateSuccess] = useState(false);

  // Copy Week state
  const [copySourceWeek, setCopySourceWeek] = useState('');
  const [copyTargetWeek, setCopyTargetWeek] = useState('');
  const [copyingWeek, setCopyingWeek] = useState(false);
  const [copyWeekResult, setCopyWeekResult] = useState<{
    message: string;
    created: Array<{ start_time: string; end_time: string }>;
    skipped: Array<{ start_time: string; reason: string }>;
  } | null>(null);

  // Import CSV state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importResult, setImportResult] = useState<{
    message: string;
    created: Array<{ date: string; time: string }>;
    skipped: Array<{ date: string; time: string; reason: string }>;
    parseErrors?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Co-hosts for combined availability (webinars)
  const [coHostIds, setCoHostIds] = useState<string[]>([]);

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

      // Fetch co-hosts for webinar events (for combined availability view)
      if (eventData.meeting_type === 'webinar') {
        const hostsRes = await fetch(`/api/events/${id}/hosts`);
        if (hostsRes.ok) {
          const hostsData = await hostsRes.json();
          // Extract just the admin IDs from the hosts array (excluding event owner)
          const hostAdminIds = (hostsData.hosts || [])
            .filter((h: { admin_id: string }) => h.admin_id !== eventData.host_id)
            .map((h: { admin_id: string }) => h.admin_id);
          setCoHostIds(hostAdminIds);
        }
      }

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

  const handleSaveAsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) return;

    setSavingTemplate(true);
    setError('');

    try {
      const response = await fetch(`/api/events/${id}/save-as-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save template');
      }

      setTemplateSuccess(true);
      setTimeout(() => {
        setShowTemplateModal(false);
        setTemplateName('');
        setTemplateDescription('');
        setTemplateSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleCopyWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copySourceWeek || !copyTargetWeek) return;

    setCopyingWeek(true);
    setError('');
    setCopyWeekResult(null);

    try {
      const response = await fetch('/api/slots/copy-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: id,
          source_week_start: copySourceWeek,
          target_week_start: copyTargetWeek,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to copy week');
      }

      setCopyWeekResult(data);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy week');
    } finally {
      setCopyingWeek(false);
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImportingCsv(true);
    setError('');
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('event_id', id);

      const response = await fetch('/api/slots/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import CSV');
      }

      setImportResult(data);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import CSV');
    } finally {
      setImportingCsv(false);
    }
  };

  const downloadSampleCsv = () => {
    const sample = `date,time
2025-02-03,10:00
2025-02-03,14:00
2025-02-04,10:00
2025-02-05,11:00`;
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-slots.csv';
    a.click();
    URL.revokeObjectURL(url);
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
      {/* Sticky Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
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
                size="base"
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
              {/* Only show "Add Time Slots" for webinars - other events use dynamic availability */}
              {event.meeting_type === 'webinar' && (
                <button
                  onClick={scrollToAddSlots}
                  className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition font-medium flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Time Slots
                </button>
              )}
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
                  <button
                    onClick={() => setShowQRModal(true)}
                    className="block w-full text-left px-4 py-2 text-sm text-[#101E57] hover:bg-gray-50"
                  >
                    QR Code
                  </button>
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
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="block w-full text-left px-4 py-2 text-sm text-[#101E57] hover:bg-gray-50"
                  >
                    Save as Template
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save as Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            {templateSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#101E57] mb-2">Template Saved!</h3>
                <p className="text-sm text-[#667085]">
                  You can find it in Settings → Templates
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-[#101E57]">Save as Template</h3>
                  <button
                    onClick={() => {
                      setShowTemplateModal(false);
                      setTemplateName('');
                      setTemplateDescription('');
                    }}
                    className="text-[#667085] hover:text-[#101E57]"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <p className="text-sm text-[#667085] mb-6">
                  Save this event&apos;s configuration as a reusable template. Settings like duration, booking rules, and email templates will be saved.
                </p>

                <form onSubmit={handleSaveAsTemplate}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Template Name
                    </label>
                    <input
                      type="text"
                      required
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., Weekly Strategy Call"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Brief description of when to use this template..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTemplateModal(false);
                        setTemplateName('');
                        setTemplateDescription('');
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-[#667085] rounded-lg hover:bg-gray-50 transition font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingTemplate || !templateName.trim()}
                      className="flex-1 px-4 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] transition font-medium disabled:opacity-50"
                    >
                      {savingTemplate ? 'Saving...' : 'Save Template'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && event && (
        <QRCodeModal
          url={`${process.env.NEXT_PUBLIC_APP_URL || 'https://www.liveschoolhelp.com'}/book/${event.slug}`}
          title={event.name}
          onClose={() => setShowQRModal(false)}
        />
      )}

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
            {/* Status badge - dynamic events show "Available" instead of "No slots" */}
            {(() => {
              const usesDynamicAvailability = event.meeting_type !== 'webinar';
              if (upcomingSlots.length === 0 && usesDynamicAvailability) {
                return (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-[#417762]/10 text-[#417762]">
                    Available
                  </span>
                );
              } else if (upcomingSlots.length === 0) {
                return (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-amber-100 text-amber-700">
                    No slots
                  </span>
                );
              } else if (totalBookings >= totalCapacity) {
                return (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-700">
                    Fully booked
                  </span>
                );
              } else {
                return (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-[#417762]/10 text-[#417762]">
                    Active
                  </span>
                );
              }
            })()}
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

        {/* Session Workflow Guide - only for webinars that have scheduled sessions */}
        {event.meeting_type === 'webinar' && (
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
                        Add recording link from Fireflies
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
        )}

        {/* Dynamic Availability Info - for non-webinar events */}
        {event.meeting_type !== 'webinar' && (
          <div className="bg-gradient-to-r from-[#417762]/5 to-[#6F71EE]/5 rounded-lg border border-[#417762]/20 p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#417762]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#417762]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[#101E57] text-lg mb-2">
                  Dynamic Availability
                </h3>
                <p className="text-[#667085] mb-4">
                  This event uses <span className="font-medium text-[#101E57]">calendar-based availability</span>.
                  Available times are automatically generated based on your calendar&apos;s free/busy status and
                  your availability patterns. Attendees can book any open time on your calendar.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/admin/settings"
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#6F71EE] hover:underline"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Manage Availability Patterns
                  </Link>
                  <span className="text-[#667085]">•</span>
                  <Link
                    href={`/admin/events/${id}/settings`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#6F71EE] hover:underline"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Event Settings (Duration, Buffer)
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Time Slots - only for webinars */}
        {event.meeting_type === 'webinar' && (
        <div ref={slotsRef} className="bg-gradient-to-br from-[#F6F6F9] to-white rounded-lg shadow-sm border border-gray-300 border-dashed p-6 mb-8 scroll-mt-4">
          {/* Header with dropdown */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[#101E57]">Add Time Slots</h2>
              <span className="px-2 py-0.5 text-xs font-medium bg-[#6F71EE]/10 text-[#6F71EE] rounded-full">
                Configuration
              </span>
            </div>
            <div className="relative">
              <select
                value={creationMode}
                onChange={(e) => setCreationMode(e.target.value as SlotCreationMode)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-[#101E57] hover:border-[#6F71EE] focus:outline-none focus:ring-2 focus:ring-[#6F71EE]/20 focus:border-[#6F71EE] cursor-pointer"
              >
                <option value="calendar">Calendar View</option>
                <option value="single">Single Slot</option>
                <option value="bulk">Bulk Create</option>
                <option value="recurring">Weekly Recurring</option>
                <option value="copy_week">Copy Week</option>
                <option value="import_csv">Import CSV</option>
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

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
              coHostIds={event?.meeting_type === 'webinar' ? coHostIds : undefined}
              onSlotCreate={async (date, time) => {
                // Pad time to ensure valid ISO format (e.g., "9:00" -> "09:00")
                const [hours, minutes] = time.split(':');
                const paddedTime = `${hours.padStart(2, '0')}:${minutes}`;
                const startTime = new Date(`${date}T${paddedTime}:00`);
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

          {/* Copy Week Form */}
          {creationMode === 'copy_week' && (
            <div>
              <form onSubmit={handleCopyWeek} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Source Week (copy from)
                    </label>
                    <input
                      type="week"
                      required
                      value={copySourceWeek}
                      onChange={(e) => setCopySourceWeek(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                    <p className="text-xs text-[#667085] mt-1">Select the week with existing slots</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Target Week (copy to)
                    </label>
                    <input
                      type="week"
                      required
                      value={copyTargetWeek}
                      onChange={(e) => setCopyTargetWeek(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                    <p className="text-xs text-[#667085] mt-1">Select the week where slots will be created</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={copyingWeek || !copySourceWeek || !copyTargetWeek}
                  className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
                >
                  {copyingWeek ? 'Copying...' : 'Copy Slots'}
                </button>
              </form>

              {copyWeekResult && (
                <div className="mt-4 p-4 bg-[#F6F6F9] rounded-lg">
                  <p className="text-sm font-medium text-[#101E57] mb-2">{copyWeekResult.message}</p>
                  {copyWeekResult.created.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-green-600 font-medium mb-1">Created:</p>
                      <div className="flex flex-wrap gap-1">
                        {copyWeekResult.created.slice(0, 10).map((slot, i) => (
                          <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            {format(parseISO(slot.start_time), 'EEE, MMM d h:mm a')}
                          </span>
                        ))}
                        {copyWeekResult.created.length > 10 && (
                          <span className="text-xs text-[#667085]">+{copyWeekResult.created.length - 10} more</span>
                        )}
                      </div>
                    </div>
                  )}
                  {copyWeekResult.skipped.length > 0 && (
                    <div>
                      <p className="text-xs text-amber-600 font-medium mb-1">Skipped:</p>
                      <div className="flex flex-wrap gap-1">
                        {copyWeekResult.skipped.slice(0, 5).map((slot, i) => (
                          <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded" title={slot.reason}>
                            {format(parseISO(slot.start_time), 'EEE, MMM d h:mm a')}
                          </span>
                        ))}
                        {copyWeekResult.skipped.length > 5 && (
                          <span className="text-xs text-[#667085]">+{copyWeekResult.skipped.length - 5} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Import CSV Form */}
          {creationMode === 'import_csv' && (
            <div>
              <form onSubmit={handleImportCsv} className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="cursor-pointer block"
                  >
                    <div className="w-12 h-12 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    {importFile ? (
                      <p className="text-sm font-medium text-[#101E57]">{importFile.name}</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-[#101E57]">Click to upload CSV file</p>
                        <p className="text-xs text-[#667085] mt-1">or drag and drop</p>
                      </>
                    )}
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={downloadSampleCsv}
                    className="text-sm text-[#6F71EE] hover:underline"
                  >
                    Download sample CSV
                  </button>
                  <button
                    type="submit"
                    disabled={importingCsv || !importFile}
                    className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
                  >
                    {importingCsv ? 'Importing...' : 'Import Slots'}
                  </button>
                </div>

                <div className="text-xs text-[#667085] bg-[#F6F6F9] rounded-lg p-3">
                  <p className="font-medium mb-1">CSV Format:</p>
                  <code className="block bg-white p-2 rounded text-[#101E57]">
                    date,time<br />
                    2025-02-03,10:00<br />
                    2025-02-03,14:00
                  </code>
                </div>
              </form>

              {importResult && (
                <div className="mt-4 p-4 bg-[#F6F6F9] rounded-lg">
                  <p className="text-sm font-medium text-[#101E57] mb-2">{importResult.message}</p>
                  {importResult.created.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-green-600 font-medium mb-1">Created:</p>
                      <div className="flex flex-wrap gap-1">
                        {importResult.created.slice(0, 10).map((slot, i) => (
                          <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            {slot.date} {slot.time}
                          </span>
                        ))}
                        {importResult.created.length > 10 && (
                          <span className="text-xs text-[#667085]">+{importResult.created.length - 10} more</span>
                        )}
                      </div>
                    </div>
                  )}
                  {importResult.skipped.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-amber-600 font-medium mb-1">Skipped:</p>
                      <div className="flex flex-wrap gap-1">
                        {importResult.skipped.slice(0, 5).map((slot, i) => (
                          <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded" title={slot.reason}>
                            {slot.date} {slot.time}
                          </span>
                        ))}
                        {importResult.skipped.length > 5 && (
                          <span className="text-xs text-[#667085]">+{importResult.skipped.length - 5} more</span>
                        )}
                      </div>
                    </div>
                  )}
                  {importResult.parseErrors && importResult.parseErrors.length > 0 && (
                    <div>
                      <p className="text-xs text-red-600 font-medium mb-1">Parse errors:</p>
                      <ul className="text-xs text-red-600 list-disc pl-4">
                        {importResult.parseErrors.slice(0, 3).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {importResult.parseErrors.length > 3 && (
                          <li>+{importResult.parseErrors.length - 3} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {creationMode !== 'calendar' && creationMode !== 'copy_week' && creationMode !== 'import_csv' && (
            <p className="text-sm text-[#667085] mt-4">
              Each slot is {event.duration_minutes} minutes. Google Calendar events with Meet links will be created automatically.
            </p>
          )}
        </div>
        )}

        {/* Upcoming Bookings - shown for all events to track confirmed meetings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">
            {event.meeting_type === 'webinar' ? 'Upcoming Time Slots' : 'Upcoming Bookings'}
          </h2>

          {slots.filter(s => !isPast(parseISO(s.end_time))).length === 0 ? (
            <div className="text-center py-12 bg-[#F6F6F9] rounded-lg">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#101E57] mb-2">
                {event.meeting_type === 'webinar' ? 'No upcoming sessions' : 'No upcoming bookings'}
              </h3>
              <p className="text-[#667085] mb-6 max-w-sm mx-auto">
                {event.meeting_type === 'webinar'
                  ? 'Create time slots above to start accepting bookings. Attendees will see available times on your public booking page.'
                  : 'Attendees can book available times directly from your public booking page. Once someone books, their meeting will appear here.'}
              </p>
              {event.meeting_type === 'webinar' ? (
                <button
                  onClick={scrollToAddSlots}
                  className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Your First Time Slot
                </button>
              ) : (
                <a
                  href={`${process.env.NEXT_PUBLIC_APP_URL || ''}/book/${event.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Booking Page
                </a>
              )}
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
