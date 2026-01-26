'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { MeetingType, MEETING_TYPE_LABELS } from '@/types';
import EventFilters from './EventFilters';
import EventActions from './EventActions';
import AvatarStack from '@/components/AvatarStack';
import SortableEventCard from './SortableEventCard';
import BulkActionsBar from './BulkActionsBar';

interface EventHost {
  admin_id: string;
  role: string;
  admin?: {
    name: string | null;
    email: string;
    profile_image: string | null;
  };
}

interface EventSlot {
  id: string;
  start_time: string;
  is_cancelled: boolean;
  bookings: { count: number }[];
}

interface EventWithAnalytics {
  id: string;
  slug: string;
  name: string;
  host_name: string;
  host_email: string;
  duration_minutes: number;
  max_attendees: number;
  meeting_type: MeetingType;
  is_active: boolean;
  created_at: string;
  display_order?: number;
  slots: EventSlot[];
  hosts?: EventHost[];
  // Primary host from event record (joined via host_id)
  primary_host?: {
    name: string | null;
    email: string;
    profile_image: string | null;
  } | null;
  // Analytics
  total_bookings?: number;
  last_booked_at?: string | null;
}

interface EventsGridProps {
  events: EventWithAnalytics[];
}

// Copy Link button with feedback
function CopyLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition whitespace-nowrap ${
        copied
          ? 'bg-emerald-500 text-white'
          : 'bg-[#6F71EE] text-white hover:bg-[#5a5cd0]'
      }`}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy Link
        </>
      )}
    </button>
  );
}

export default function EventsGrid({ events: initialEvents }: EventsGridProps) {
  const [events, setEvents] = useState(initialEvents);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<MeetingType | 'all'>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reorderMode, setReorderMode] = useState(false);

  // Sync events when prop changes
  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem('eventsViewPreference');
    if (savedView === 'grid' || savedView === 'list') {
      setView(savedView);
    }
  }, []);

  // Save view preference to localStorage
  const handleViewChange = (newView: 'grid' | 'list') => {
    setView(newView);
    localStorage.setItem('eventsViewPreference', newView);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<MeetingType | 'all', number> = {
      all: events.length,
      one_on_one: 0,
      group: 0,
      round_robin: 0,
      collective: 0,
      panel: 0,
      webinar: 0,
    };
    events.forEach((event) => {
      counts[event.meeting_type]++;
    });
    return counts;
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Tab filter
      if (activeTab !== 'all' && event.meeting_type !== activeTab) {
        return false;
      }

      // Search filter
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        const matchesName = event.name.toLowerCase().includes(search);
        const matchesHost = event.host_name?.toLowerCase().includes(search);
        if (!matchesName && !matchesHost) {
          return false;
        }
      }

      return true;
    });
  }, [events, activeTab, debouncedSearch]);

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const oldIndex = events.findIndex((e) => e.id === active.id);
      const newIndex = events.findIndex((e) => e.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Optimistically update local state
      const newEvents = [...events];
      const [removed] = newEvents.splice(oldIndex, 1);
      newEvents.splice(newIndex, 0, removed);

      // Update display_order values
      const updatedEvents = newEvents.map((e, i) => ({
        ...e,
        display_order: i,
      }));

      setEvents(updatedEvents);

      // Persist to server
      try {
        const items = updatedEvents.map((e, i) => ({
          id: e.id,
          display_order: i,
        }));

        const response = await fetch('/api/events/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });

        if (!response.ok) {
          throw new Error('Failed to save order');
        }
      } catch (error) {
        console.error('Reorder error:', error);
        // Revert on error
        setEvents(initialEvents);
      }
    },
    [events, initialEvents]
  );

  // Selection handlers
  const toggleSelection = useCallback((eventId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredEvents.map((e) => e.id)));
  }, [filteredEvents]);

  // Helper to format "last booked" time
  const formatLastBooked = (date: string | null | undefined) => {
    if (!date) return 'Never';
    const now = new Date();
    const booked = new Date(date);
    const diffDays = Math.floor((now.getTime() - booked.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  // Get status for event
  const getEventStatus = (event: EventWithAnalytics) => {
    const activeSlots = event.slots?.filter(
      (s) => !s.is_cancelled && new Date(s.start_time) > new Date()
    ) || [];

    const totalBookings = activeSlots.reduce(
      (sum, s) => sum + (s.bookings?.[0]?.count || 0),
      0
    );
    const totalCapacity = activeSlots.length * event.max_attendees;
    const capacityPercent = totalCapacity > 0 ? Math.round((totalBookings / totalCapacity) * 100) : 0;

    const usesDynamicAvailability = event.meeting_type !== 'webinar';

    if (!event.is_active) {
      return { label: 'Disabled', color: 'bg-gray-200 text-gray-700 border-gray-400', isDimmed: true };
    } else if (activeSlots.length === 0 && !usesDynamicAvailability) {
      return { label: 'No slots', color: 'bg-amber-200 text-amber-900 border-amber-500', isDimmed: true };
    } else if (activeSlots.length === 0 && usesDynamicAvailability) {
      return { label: 'Available', color: 'bg-emerald-100 text-emerald-800 border-emerald-400', isDimmed: false };
    } else if (capacityPercent >= 100) {
      return { label: 'Fully booked', color: 'bg-red-200 text-red-900 border-red-500', isDimmed: false };
    } else if (capacityPercent >= 80) {
      return { label: 'Almost full', color: 'bg-amber-200 text-amber-900 border-amber-500', isDimmed: false };
    }
    return { label: 'Active', color: 'bg-emerald-100 text-emerald-800 border-emerald-400', isDimmed: false };
  };

  // Get hosts for avatar display, sorted by role priority (owner > host > backup)
  const getEventHosts = (event: EventWithAnalytics) => {
    const hosts: Array<{ name: string; image: string | null | undefined }> = [];

    // Add primary host first (from event record's host_id)
    if (event.primary_host) {
      hosts.push({
        name: event.primary_host.name || event.primary_host.email || event.host_name || 'Unknown',
        image: event.primary_host.profile_image,
      });
    }

    // Add co-hosts from oh_event_hosts, sorted by role
    if (event.hosts && event.hosts.length > 0) {
      const rolePriority: Record<string, number> = { owner: 0, host: 1, backup: 2 };
      const sortedHosts = [...event.hosts].sort((a, b) => {
        const priorityA = rolePriority[a.role || 'backup'] ?? 2;
        const priorityB = rolePriority[b.role || 'backup'] ?? 2;
        return priorityA - priorityB;
      });

      for (const h of sortedHosts) {
        // Skip if this host is already the primary host (avoid duplicates)
        const hostEmail = h.admin?.email;
        if (event.primary_host && hostEmail === event.primary_host.email) {
          continue;
        }
        hosts.push({
          name: h.admin?.name || h.admin?.email || 'Unknown',
          image: h.admin?.profile_image,
        });
      }
    }

    // Fallback to host_name if no hosts found
    if (hosts.length === 0) {
      return [{ name: event.host_name || 'Unknown', image: null }];
    }

    return hosts;
  };

  // Render event card content (shared between grid and sortable)
  const renderEventCard = (event: EventWithAnalytics, isSelected: boolean) => {
    const status = getEventStatus(event);
    const hosts = getEventHosts(event);
    const activeSlots = event.slots?.filter(
      (s) => !s.is_cancelled && new Date(s.start_time) > new Date()
    ) || [];
    const totalBookingsInSlots = activeSlots.reduce(
      (sum, s) => sum + (s.bookings?.[0]?.count || 0),
      0
    );
    const totalCapacity = activeSlots.length * event.max_attendees;
    const capacityPercent = totalCapacity > 0 ? Math.round((totalBookingsInSlots / totalCapacity) * 100) : 0;
    const usesDynamicAvailability = event.meeting_type !== 'webinar';

    return (
      <div className={`bg-white rounded-lg shadow-sm border transition-all group ${
        isSelected ? 'border-[#6F71EE] ring-2 ring-[#6F71EE]/20' : 'border-gray-200 hover:border-[#6F71EE]/50 hover:shadow-md'
      } ${status.isDimmed ? 'opacity-60' : ''}`}>
        <Link href={`/admin/events/${event.id}`} className="block p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Checkbox */}
              <div
                onClick={(e) => toggleSelection(event.id, e)}
                className="flex-shrink-0 flex items-center justify-center w-5 h-5 mt-0.5 cursor-pointer"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
                  isSelected
                    ? 'bg-[#6F71EE] border-[#6F71EE]'
                    : 'border-gray-300 hover:border-[#6F71EE]'
                }`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Host Avatar(s) */}
              <div className="flex-shrink-0">
                <AvatarStack avatars={hosts} size="md" maxVisible={3} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-[#101E57] group-hover:text-[#6F71EE] transition truncate">
                    {event.name}
                  </h3>
                  <span className={`flex-shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full border ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-[#667085] text-sm">
                  {event.duration_minutes} min · {MEETING_TYPE_LABELS[event.meeting_type]}
                </p>
              </div>
            </div>
          </div>

          {/* Capacity bar - only show for webinars or events with slots */}
          {(activeSlots.length > 0 || !usesDynamicAvailability) ? (
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#667085]">
                  {totalBookingsInSlots}/{activeSlots.length * event.max_attendees} booked
                </span>
                <span className="text-[#101E57] font-medium">
                  {capacityPercent}%
                </span>
              </div>
              <div className="h-1.5 bg-[#F6F6F9] rounded-full overflow-hidden">
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
          ) : (
            <p className="text-xs text-[#667085] mb-2">
              Dynamic availability
            </p>
          )}

          {/* Analytics - combined into one line */}
          <p className="text-sm text-[#667085] mb-2">
            {formatLastBooked(event.last_booked_at)} · {event.total_bookings ?? 0} booking{(event.total_bookings ?? 0) !== 1 ? 's' : ''}
          </p>

          {/* Prominent CTA for events with no bookings */}
          {(event.total_bookings ?? 0) === 0 && (
            <div className="p-2 bg-[#6F71EE]/5 border border-[#6F71EE]/20 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-[#667085]">
                  No bookings yet
                </p>
                <CopyLinkButton slug={event.slug} />
              </div>
            </div>
          )}
        </Link>

        {/* Quick actions bar */}
        <div className="px-4 py-2 bg-[#F6F6F9] border-t border-gray-100 flex items-center justify-end gap-2">
          <EventActions eventId={event.id} eventSlug={event.slug} eventName={event.name} />
        </div>
      </div>
    );
  };

  if (filteredEvents.length === 0 && events.length > 0) {
    return (
      <>
        <EventFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabCounts={tabCounts}
          view={view}
          onViewChange={handleViewChange}
        />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#101E57] mb-2">No matching events</h3>
          <p className="text-[#667085] mb-4">
            {searchQuery
              ? `No events match "${searchQuery}"`
              : `No ${activeTab !== 'all' ? MEETING_TYPE_LABELS[activeTab].toLowerCase() : ''} events found`}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveTab('all');
            }}
            className="text-[#6F71EE] hover:text-[#5a5cd0] font-medium"
          >
            Clear filters
          </button>
        </div>
      </>
    );
  }

  // Determine if reordering is possible (no filters active)
  const canReorder = activeTab === 'all' && !debouncedSearch;

  return (
    <>
      <EventFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabCounts={tabCounts}
        view={view}
        onViewChange={handleViewChange}
      />

      {/* Selection actions bar */}
      {filteredEvents.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={selectedIds.size === filteredEvents.length ? clearSelection : selectAll}
              className="text-sm text-[#667085] hover:text-[#6F71EE] transition"
            >
              {selectedIds.size === filteredEvents.length ? 'Deselect all' : 'Select all'}
            </button>
            {selectedIds.size > 0 && (
              <span className="text-sm text-[#667085]">
                ({selectedIds.size} selected)
              </span>
            )}
          </div>
          {canReorder && (
            <button
              onClick={() => setReorderMode(!reorderMode)}
              className={`flex items-center gap-1.5 text-sm font-medium transition ${
                reorderMode ? 'text-[#6F71EE]' : 'text-[#667085] hover:text-[#6F71EE]'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
              </svg>
              {reorderMode ? 'Done reordering' : 'Reorder'}
            </button>
          )}
        </div>
      )}

      {view === 'grid' ? (
        // Grid View with optional drag-and-drop
        canReorder && reorderMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredEvents.map((e) => e.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid gap-4 pl-8 lg:grid-cols-2">
                {filteredEvents.map((event) => (
                  <SortableEventCard key={event.id} id={event.id}>
                    {renderEventCard(event, selectedIds.has(event.id))}
                  </SortableEventCard>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredEvents.map((event) => (
              <div key={event.id}>
                {renderEventCard(event, selectedIds.has(event.id))}
              </div>
            ))}
          </div>
        )
      ) : (
        // List View
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
          {filteredEvents.map((event) => {
            const status = getEventStatus(event);
            const hosts = getEventHosts(event);
            const isSelected = selectedIds.has(event.id);

            return (
              <div
                key={event.id}
                className={`flex items-center gap-4 p-4 hover:bg-[#F6F6F9]/50 transition group ${
                  isSelected ? 'bg-[#6F71EE]/5' : ''
                } ${status.isDimmed ? 'opacity-60' : ''}`}
              >
                {/* Checkbox */}
                <div
                  onClick={(e) => toggleSelection(event.id, e)}
                  className="flex-shrink-0 cursor-pointer"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
                    isSelected
                      ? 'bg-[#6F71EE] border-[#6F71EE]'
                      : 'border-gray-300 hover:border-[#6F71EE]'
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>

                <Link
                  href={`/admin/events/${event.id}`}
                  className="flex items-center gap-4 flex-1 min-w-0"
                >
                  {/* Host Avatar(s) */}
                  <div className="flex-shrink-0">
                    <AvatarStack avatars={hosts} size="sm" maxVisible={2} />
                  </div>

                  {/* Event Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#101E57] group-hover:text-[#6F71EE] transition truncate">
                        {event.name}
                      </h3>
                      <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full border ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-[#667085] text-sm">
                      {event.duration_minutes} min · {MEETING_TYPE_LABELS[event.meeting_type]}
                    </p>
                  </div>

                  {/* Analytics */}
                  <div className="hidden sm:flex items-center gap-6 text-sm text-[#667085]">
                    <span className="whitespace-nowrap">
                      Last: {formatLastBooked(event.last_booked_at)}
                    </span>
                    <span className="whitespace-nowrap">
                      {event.total_bookings ?? 0} bookings
                    </span>
                  </div>
                </Link>

                {/* Actions */}
                <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <EventActions eventId={event.id} eventSlug={event.slug} eventName={event.name} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
        onClearSelection={clearSelection}
      />
    </>
  );
}
