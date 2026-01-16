'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, addDays, startOfWeek, parseISO, isSameDay, isToday, isPast } from 'date-fns';

interface TimeBlock {
  start: string;
  end: string;
  type: 'busy' | 'slot' | 'available';
  title?: string;
  slotId?: string;
}

interface DaySchedule {
  date: string;
  dayOfWeek: string;
  blocks: TimeBlock[];
  availableWindows: { start: string; end: string }[];
  hasAvailabilityPatterns: boolean;
}

interface WeekSchedule {
  weekStart: string;
  weekEnd: string;
  timezone: string;
  days: DaySchedule[];
}

interface WeekCalendarProps {
  eventId: string;
  slotDuration: number;
  onSlotCreate: (date: string, time: string) => void;
  onSlotClick?: (slotId: string) => void;
}

// Time range for the calendar (8am to 6pm)
const START_HOUR = 8;
const END_HOUR = 18;
const SLOT_HEIGHT = 24; // pixels per 30-min slot
const TIME_SLOTS_COUNT = (END_HOUR - START_HOUR) * 2; // 30-min slots

// Convert HH:mm to minutes since midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Check if a time falls within available windows
function isInAvailableWindow(time: string, windows: { start: string; end: string }[]): boolean {
  const minutes = timeToMinutes(time);
  return windows.some((w) => {
    const startMin = timeToMinutes(w.start);
    const endMin = timeToMinutes(w.end);
    return minutes >= startMin && minutes < endMin;
  });
}

// Check if a specific time slot is blocked
function isTimeBlocked(time: string, blocks: TimeBlock[], slotDuration: number): boolean {
  const slotStart = timeToMinutes(time);
  const slotEnd = slotStart + slotDuration;

  return blocks.some((block) => {
    const blockStart = timeToMinutes(block.start);
    const blockEnd = timeToMinutes(block.end);
    // Check for overlap
    return slotStart < blockEnd && slotEnd > blockStart;
  });
}

export default function WeekCalendar({
  eventId,
  slotDuration,
  onSlotCreate,
  onSlotClick,
}: WeekCalendarProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => {
    // Start from Monday of current week
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredCell, setHoveredCell] = useState<{ date: string; time: string } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ date: string; time: string } | null>(null);
  const [creating, setCreating] = useState(false);

  // Generate time labels
  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      labels.push(`${hour}:00`);
      labels.push(`${hour}:30`);
    }
    return labels;
  }, []);

  // Fetch week schedule
  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      setError('');
      try {
        const weekStartStr = format(weekStart, 'yyyy-MM-dd');
        const response = await fetch(
          `/api/availability/week?weekStart=${weekStartStr}&eventId=${eventId}`
        );
        if (!response.ok) {
          throw new Error('Failed to load calendar data');
        }
        const data = await response.json();
        setSchedule(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load calendar');
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [weekStart, eventId]);

  const handlePrevWeek = () => {
    setWeekStart((prev) => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setWeekStart((prev) => addDays(prev, 7));
  };

  const handleToday = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const handleCellClick = (date: string, time: string, day: DaySchedule) => {
    // Check if this time is available
    const isBlocked = isTimeBlocked(time, day.blocks, slotDuration);
    const dateObj = parseISO(date);
    const slotDateTime = parseISO(`${date}T${time}`);

    if (isBlocked || isPast(slotDateTime)) {
      return;
    }

    setSelectedCell({ date, time });
  };

  const handleConfirmCreate = async () => {
    if (!selectedCell) return;

    setCreating(true);
    try {
      await onSlotCreate(selectedCell.date, selectedCell.time);
      setSelectedCell(null);
      // Refresh the schedule
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const response = await fetch(
        `/api/availability/week?weekStart=${weekStartStr}&eventId=${eventId}`
      );
      if (response.ok) {
        const data = await response.json();
        setSchedule(data);
      }
    } catch (err) {
      console.error('Failed to create slot:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleCancelCreate = () => {
    setSelectedCell(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="animate-pulse text-[#667085]">Loading calendar...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => setWeekStart(weekStart)}
          className="mt-4 text-[#6F71EE] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header with navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#F6F6F9]">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
            aria-label="Previous week"
          >
            <svg className="w-5 h-5 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-medium text-[#101E57] min-w-[180px] text-center">
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <button
            onClick={handleNextWeek}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
            aria-label="Next week"
          >
            <svg className="w-5 h-5 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <button
          onClick={handleToday}
          className="px-3 py-1.5 text-sm font-medium text-[#6F71EE] hover:bg-[#6F71EE]/10 rounded-lg transition"
        >
          Today
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 text-xs text-[#667085]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#667085]/30 rounded" />
          <span>Busy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#6F71EE] rounded" />
          <span>Existing Slot</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#417762]/20 border border-[#417762]/40 rounded" />
          <span>Your Available Hours</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200">
            <div className="p-2" /> {/* Empty corner */}
            {schedule?.days.map((day) => {
              const dateObj = parseISO(day.date);
              const isCurrentDay = isToday(dateObj);
              return (
                <div
                  key={day.date}
                  className={`p-2 text-center border-l border-gray-200 ${
                    isCurrentDay ? 'bg-[#6F71EE]/5' : ''
                  }`}
                >
                  <div className="text-xs text-[#667085]">{day.dayOfWeek.slice(0, 3)}</div>
                  <div
                    className={`text-sm font-medium ${
                      isCurrentDay
                        ? 'w-7 h-7 bg-[#6F71EE] text-white rounded-full flex items-center justify-center mx-auto'
                        : 'text-[#101E57]'
                    }`}
                  >
                    {format(dateObj, 'd')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="relative">
            {timeLabels.map((time, timeIndex) => {
              const isHourMark = time.endsWith(':00');
              return (
                <div
                  key={time}
                  className={`grid grid-cols-[60px_repeat(7,1fr)] ${
                    isHourMark ? 'border-t border-gray-200' : 'border-t border-gray-100'
                  }`}
                  style={{ height: SLOT_HEIGHT }}
                >
                  {/* Time label */}
                  <div className="text-xs text-[#667085] pr-2 flex items-start justify-end -mt-2">
                    {isHourMark && (
                      <span>
                        {parseInt(time) > 12
                          ? `${parseInt(time) - 12}pm`
                          : parseInt(time) === 12
                          ? '12pm'
                          : `${parseInt(time)}am`}
                      </span>
                    )}
                  </div>

                  {/* Day cells */}
                  {schedule?.days.map((day) => {
                    const dateObj = parseISO(day.date);
                    const slotDateTime = parseISO(`${day.date}T${time}`);
                    const isBlocked = isTimeBlocked(time, day.blocks, slotDuration);
                    const isAvailable = isInAvailableWindow(time, day.availableWindows);
                    const isPastSlot = isPast(slotDateTime);
                    const isHovered =
                      hoveredCell?.date === day.date && hoveredCell?.time === time;
                    const isSelected =
                      selectedCell?.date === day.date && selectedCell?.time === time;
                    const isCurrentDay = isToday(dateObj);

                    // Find blocks that overlap this time slot
                    const overlappingBlocks = day.blocks.filter((block) => {
                      const blockStart = timeToMinutes(block.start);
                      const blockEnd = timeToMinutes(block.end);
                      const slotStart = timeToMinutes(time);
                      return slotStart >= blockStart && slotStart < blockEnd;
                    });

                    return (
                      <div
                        key={`${day.date}-${time}`}
                        className={`border-l border-gray-200 relative cursor-pointer transition-colors ${
                          isCurrentDay ? 'bg-[#6F71EE]/5' : ''
                        } ${isAvailable && !isBlocked && !isPastSlot ? 'bg-[#417762]/10' : ''} ${
                          isHovered && !isBlocked && !isPastSlot ? 'bg-[#6F71EE]/20' : ''
                        } ${isSelected ? 'bg-[#6F71EE]/30 ring-2 ring-[#6F71EE] ring-inset' : ''} ${
                          isPastSlot ? 'bg-gray-50' : ''
                        }`}
                        onMouseEnter={() =>
                          !isBlocked && !isPastSlot && setHoveredCell({ date: day.date, time })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => handleCellClick(day.date, time, day)}
                      >
                        {/* Render blocks */}
                        {overlappingBlocks.map((block, idx) => (
                          <div
                            key={idx}
                            className={`absolute inset-x-0.5 rounded text-xs px-1 overflow-hidden ${
                              block.type === 'busy'
                                ? 'bg-[#667085]/30 text-[#667085]'
                                : 'bg-[#6F71EE] text-white'
                            }`}
                            style={{
                              top: 1,
                              height: SLOT_HEIGHT - 2,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (block.slotId && onSlotClick) {
                                onSlotClick(block.slotId);
                              }
                            }}
                          >
                            <span className="truncate block text-[10px] leading-tight mt-0.5">
                              {block.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Slot creation confirmation */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-[#101E57] mb-2">Create Time Slot</h3>
            <p className="text-[#667085] mb-4">
              Create a {slotDuration}-minute slot on{' '}
              <strong>{format(parseISO(selectedCell.date), 'EEEE, MMMM d')}</strong> at{' '}
              <strong>
                {parseInt(selectedCell.time) > 12
                  ? `${parseInt(selectedCell.time) - 12}:${selectedCell.time.split(':')[1]} PM`
                  : parseInt(selectedCell.time) === 12
                  ? `12:${selectedCell.time.split(':')[1]} PM`
                  : `${parseInt(selectedCell.time)}:${selectedCell.time.split(':')[1]} AM`}
              </strong>
              ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelCreate}
                disabled={creating}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-[#667085] hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreate}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
