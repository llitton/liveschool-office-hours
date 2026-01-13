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

// Time range to display (8am to 8pm)
const START_HOUR = 8;
const END_HOUR = 20;
const TOTAL_HOURS = END_HOUR - START_HOUR;

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToPosition(minutes: number): number {
  const startMinutes = START_HOUR * 60;
  const endMinutes = END_HOUR * 60;
  const totalMinutes = endMinutes - startMinutes;
  return ((minutes - startMinutes) / totalMinutes) * 100;
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

  // Generate hour markers
  const hours = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hours.push(h);
  }

  // Calculate clickable time slots (every 30 min within available windows or all if no patterns)
  const clickableSlots: string[] = [];
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

  // Generate 30-min slots
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      if (checkAvailable(time)) {
        clickableSlots.push(time);
      }
    }
  }

  const handleTimeClick = (time: string) => {
    if (onSelectTime) {
      onSelectTime(time);
    }
  };

  return (
    <div className="mt-4 bg-[#F6F6F9] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[#101E57]">
          {schedule.dayOfWeek} Schedule
        </p>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-gray-300" />
            Busy
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#6F71EE]" />
            OH Slot
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#417762]" />
            Available
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Hour labels */}
        <div className="flex justify-between text-xs text-[#667085] mb-1">
          {hours.map((h) => (
            <span key={h} className="w-8 text-center">
              {h > 12 ? `${h - 12}p` : h === 12 ? '12p' : `${h}a`}
            </span>
          ))}
        </div>

        {/* Timeline bar */}
        <div className="relative h-12 bg-white rounded border border-gray-200">
          {/* Available windows background */}
          {schedule.hasAvailabilityPatterns &&
            schedule.availableWindows.map((window, i) => {
              const startMin = timeToMinutes(window.start);
              const endMin = timeToMinutes(window.end);
              const left = minutesToPosition(startMin);
              const width = minutesToPosition(endMin) - left;

              return (
                <div
                  key={`avail-${i}`}
                  className="absolute top-0 bottom-0 bg-[#417762]/10"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              );
            })}

          {/* Busy blocks */}
          {schedule.blocks.map((block, i) => {
            const startMin = timeToMinutes(block.start);
            const endMin = timeToMinutes(block.end);

            // Clamp to visible range
            const clampedStart = Math.max(startMin, START_HOUR * 60);
            const clampedEnd = Math.min(endMin, END_HOUR * 60);

            if (clampedStart >= clampedEnd) return null;

            const left = minutesToPosition(clampedStart);
            const width = minutesToPosition(clampedEnd) - left;

            return (
              <div
                key={`block-${i}`}
                className={`absolute top-1 bottom-1 rounded ${
                  block.type === 'busy'
                    ? 'bg-gray-300'
                    : 'bg-[#6F71EE]'
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${block.title || block.type}: ${block.start} - ${block.end}`}
              >
                {width > 8 && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-white truncate px-1">
                    {block.title || block.type}
                  </span>
                )}
              </div>
            );
          })}

          {/* Selected time indicator */}
          {selectedTime && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-[#417762] z-10"
              style={{ left: `${minutesToPosition(timeToMinutes(selectedTime))}%` }}
            />
          )}
        </div>

        {/* Clickable available slots */}
        <div className="mt-3">
          <p className="text-xs text-[#667085] mb-2">
            {clickableSlots.length > 0
              ? 'Click an available time:'
              : 'No available times in this range'}
          </p>
          <div className="flex flex-wrap gap-2">
            {clickableSlots.slice(0, 16).map((time) => {
              const hour = parseInt(time.split(':')[0]);
              const minute = time.split(':')[1];
              const displayTime =
                hour > 12
                  ? `${hour - 12}:${minute} PM`
                  : hour === 12
                  ? `12:${minute} PM`
                  : `${hour}:${minute} AM`;

              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => handleTimeClick(time)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                    selectedTime === time
                      ? 'bg-[#417762] text-white'
                      : 'bg-white border border-[#417762] text-[#417762] hover:bg-[#417762]/10'
                  }`}
                >
                  {displayTime}
                </button>
              );
            })}
            {clickableSlots.length > 16 && (
              <span className="px-3 py-1.5 text-sm text-[#667085]">
                +{clickableSlots.length - 16} more
              </span>
            )}
          </div>
        </div>
      </div>

      {!schedule.hasAvailabilityPatterns && (
        <p className="text-xs text-[#667085] mt-3">
          Tip: Set up{' '}
          <a href="/admin/availability" className="text-[#6F71EE] hover:underline">
            availability patterns
          </a>{' '}
          to highlight your preferred hours.
        </p>
      )}
    </div>
  );
}
