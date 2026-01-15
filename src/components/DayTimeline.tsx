'use client';

import { useState, useEffect } from 'react';

interface TimeBlock {
  start: string;
  end: string;
  type: 'busy' | 'slot' | 'available';
  title?: string;
}

interface DaySchedule {
  date: string;
  dayOfWeek: string;
  blocks: TimeBlock[];
  availableWindows: { start: string; end: string }[];
  hasAvailabilityPatterns: boolean;
}

interface DayTimelineProps {
  date: string;
  eventId?: string;
  onSelectTime?: (time: string) => void;
  selectedTime?: string;
  slotDuration?: number;
}

// Time range to display (8am to 6pm)
const START_HOUR = 8;
const END_HOUR = 18;

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(hour: number, minute: number = 0): string {
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return minute === 0 ? `${h} ${ampm}` : `${h}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

export default function DayTimeline({
  date,
  eventId,
  onSelectTime,
  selectedTime,
  slotDuration = 30,
}: DayTimelineProps) {
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!date) {
      setSchedule(null);
      return;
    }

    const fetchSchedule = async () => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({ date });
        if (eventId) params.set('eventId', eventId);

        const response = await fetch(`/api/availability/day?${params}`);
        if (!response.ok) throw new Error('Failed to load schedule');

        const data = await response.json();
        setSchedule(data);
      } catch (err) {
        setError('Failed to load calendar');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [date, eventId]);

  if (!date) return null;

  if (loading) {
    return (
      <div className="mt-4 p-4 bg-[#F6F6F9] rounded-lg">
        <p className="text-sm text-[#667085]">Loading calendar...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 p-4 bg-red-50 rounded-lg">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!schedule) return null;

  // Check if a time slot is available
  const checkAvailable = (time: string): boolean => {
    const timeMin = timeToMinutes(time);
    const slotEndMin = timeMin + slotDuration;

    // Check if within displayed range
    if (timeMin < START_HOUR * 60 || slotEndMin > END_HOUR * 60) return false;

    // Check if conflicts with any busy block
    for (const block of schedule.blocks) {
      const blockStart = timeToMinutes(block.start);
      const blockEnd = timeToMinutes(block.end);
      // Overlap check
      if (timeMin < blockEnd && slotEndMin > blockStart) {
        return false;
      }
    }

    // If availability patterns are set, check if within available windows
    if (schedule.hasAvailabilityPatterns && schedule.availableWindows.length > 0) {
      for (const window of schedule.availableWindows) {
        const windowStart = timeToMinutes(window.start);
        const windowEnd = timeToMinutes(window.end);
        if (timeMin >= windowStart && slotEndMin <= windowEnd) {
          return true;
        }
      }
      return false;
    }

    return true;
  };

  // Get block at a specific time
  const getBlockAt = (hour: number, minute: number): TimeBlock | null => {
    const timeMin = hour * 60 + minute;
    for (const block of schedule.blocks) {
      const blockStart = timeToMinutes(block.start);
      const blockEnd = timeToMinutes(block.end);
      if (timeMin >= blockStart && timeMin < blockEnd) {
        return block;
      }
    }
    return null;
  };

  // Check if time is within available window
  const isInAvailableWindow = (hour: number, minute: number): boolean => {
    if (!schedule.hasAvailabilityPatterns) return true;
    const timeMin = hour * 60 + minute;
    for (const window of schedule.availableWindows) {
      const windowStart = timeToMinutes(window.start);
      const windowEnd = timeToMinutes(window.end);
      if (timeMin >= windowStart && timeMin < windowEnd) {
        return true;
      }
    }
    return false;
  };

  const handleTimeClick = (hour: number, minute: number) => {
    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    if (checkAvailable(time) && onSelectTime) {
      onSelectTime(time);
    }
  };

  // Generate time slots
  const timeSlots: { hour: number; minute: number }[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    timeSlots.push({ hour: h, minute: 0 });
    timeSlots.push({ hour: h, minute: 30 });
  }

  return (
    <div className="mt-4 bg-[#F6F6F9] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[#101E57]">
          {schedule.dayOfWeek} Schedule
        </p>
        <div className="flex items-center gap-3 text-xs text-[#667085]">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-gray-400" />
            Busy
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-[#6F71EE]" />
            OH Slot
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-[#417762]" />
            Available
          </span>
        </div>
      </div>

      {/* Vertical Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-h-[400px] overflow-y-auto">
        {timeSlots.map(({ hour, minute }, index) => {
          const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const block = getBlockAt(hour, minute);
          const isAvailable = checkAvailable(time);
          const inAvailWindow = isInAvailableWindow(hour, minute);
          const isSelected = selectedTime === time;
          const isHourMark = minute === 0;

          // Skip if this slot is continuation of a block (show block only on first row)
          const prevSlot = index > 0 ? timeSlots[index - 1] : null;
          const prevBlock = prevSlot ? getBlockAt(prevSlot.hour, prevSlot.minute) : null;
          const isBlockContinuation = block && prevBlock &&
            block.start === prevBlock.start && block.end === prevBlock.end;

          return (
            <div
              key={time}
              className={`flex items-stretch border-b border-gray-100 last:border-b-0 ${
                isHourMark ? 'border-t border-gray-200' : ''
              }`}
            >
              {/* Time label */}
              <div className={`w-20 flex-shrink-0 px-3 py-2 text-xs ${
                isHourMark ? 'font-medium text-[#101E57]' : 'text-[#667085]'
              } ${inAvailWindow && !block ? 'bg-[#417762]/5' : 'bg-gray-50'}`}>
                {formatTime(hour, minute)}
              </div>

              {/* Slot content */}
              <div
                className={`flex-1 px-3 py-2 min-h-[40px] flex items-center transition cursor-pointer ${
                  block
                    ? block.type === 'busy'
                      ? 'bg-gray-200'
                      : 'bg-[#6F71EE]/20'
                    : isSelected
                    ? 'bg-[#417762] text-white'
                    : isAvailable
                    ? inAvailWindow
                      ? 'bg-[#417762]/10 hover:bg-[#417762]/20'
                      : 'bg-white hover:bg-gray-50'
                    : 'bg-gray-50'
                }`}
                onClick={() => !block && handleTimeClick(hour, minute)}
              >
                {block && !isBlockContinuation ? (
                  <span className={`text-xs font-medium ${
                    block.type === 'busy' ? 'text-gray-600' : 'text-[#6F71EE]'
                  }`}>
                    {block.title || (block.type === 'busy' ? 'Busy' : 'Session')}
                    <span className="font-normal ml-2 opacity-75">
                      {block.start} - {block.end}
                    </span>
                  </span>
                ) : isSelected ? (
                  <span className="text-xs font-medium">
                    Selected - {slotDuration} min slot
                  </span>
                ) : isAvailable ? (
                  <span className="text-xs text-[#417762]">
                    Click to select
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {!schedule.hasAvailabilityPatterns && (
        <p className="text-xs text-[#667085] mt-3">
          Tip:{' '}
          <a href="/admin/settings" className="text-[#6F71EE] hover:underline">
            Set up availability patterns
          </a>{' '}
          to highlight your preferred hours.
        </p>
      )}
    </div>
  );
}
