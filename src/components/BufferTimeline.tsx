'use client';

interface BufferTimelineProps {
  duration: number; // in minutes
  bufferBefore: number; // in minutes
  bufferAfter: number; // in minutes
}

export default function BufferTimeline({ duration, bufferBefore, bufferAfter }: BufferTimelineProps) {
  const totalTime = bufferBefore + duration + bufferAfter;
  const bufferBeforePercent = (bufferBefore / totalTime) * 100;
  const durationPercent = (duration / totalTime) * 100;
  const bufferAfterPercent = (bufferAfter / totalTime) * 100;

  // Calculate time markers
  const startTime = 9 * 60; // 9:00 AM in minutes
  const meetingStart = startTime + bufferBefore;
  const meetingEnd = meetingStart + duration;
  const blockEnd = meetingEnd + bufferAfter;

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHour}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="bg-[#F6F6F9] rounded-lg p-4">
      <p className="text-xs font-medium text-[#667085] mb-3">Timeline Preview</p>

      {/* Timeline bar */}
      <div className="relative">
        <div className="flex h-10 rounded-lg overflow-hidden shadow-sm">
          {bufferBefore > 0 && (
            <div
              style={{ width: `${bufferBeforePercent}%` }}
              className="bg-amber-200 flex items-center justify-center transition-all duration-300"
            >
              {bufferBefore >= 10 && (
                <span className="text-xs text-amber-700 font-medium">{bufferBefore}m</span>
              )}
            </div>
          )}
          <div
            style={{ width: `${durationPercent}%` }}
            className="bg-[#6F71EE] flex items-center justify-center transition-all duration-300"
          >
            <span className="text-xs text-white font-medium">{duration}m meeting</span>
          </div>
          {bufferAfter > 0 && (
            <div
              style={{ width: `${bufferAfterPercent}%` }}
              className="bg-amber-200 flex items-center justify-center transition-all duration-300"
            >
              {bufferAfter >= 10 && (
                <span className="text-xs text-amber-700 font-medium">{bufferAfter}m</span>
              )}
            </div>
          )}
        </div>

        {/* Time markers */}
        <div className="flex justify-between mt-2 text-xs text-[#667085]">
          <span>{formatTime(startTime)}</span>
          {bufferBefore > 0 && (
            <span>{formatTime(meetingStart)}</span>
          )}
          <span>{formatTime(meetingEnd)}</span>
          {bufferAfter > 0 && (
            <span>{formatTime(blockEnd)}</span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-[#6F71EE]" />
          <span className="text-[#667085]">Meeting</span>
        </div>
        {(bufferBefore > 0 || bufferAfter > 0) && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-200" />
            <span className="text-[#667085]">Buffer (blocked)</span>
          </div>
        )}
      </div>

      {/* Explanation */}
      {(bufferBefore > 0 || bufferAfter > 0) && (
        <p className="text-xs text-[#667085] mt-2">
          Total blocked time: <span className="font-medium text-[#101E57]">{totalTime} minutes</span>
          {bufferBefore > 0 && bufferAfter > 0 && (
            <> ({bufferBefore}m before + {duration}m meeting + {bufferAfter}m after)</>
          )}
          {bufferBefore > 0 && bufferAfter === 0 && (
            <> ({bufferBefore}m before + {duration}m meeting)</>
          )}
          {bufferBefore === 0 && bufferAfter > 0 && (
            <> ({duration}m meeting + {bufferAfter}m after)</>
          )}
        </p>
      )}
    </div>
  );
}
