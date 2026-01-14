'use client';

import { useState, useEffect } from 'react';
import {
  COMMON_TIMEZONES,
  detectUserTimezone,
  getTimezoneLabel,
  getReadableUTCOffset,
} from '@/lib/timezone';

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  disabled?: boolean;
  showOffset?: boolean;
  className?: string;
}

export default function TimezoneSelector({
  value,
  onChange,
  disabled = false,
  showOffset = true,
  className = '',
}: TimezoneSelectorProps) {
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null);

  useEffect(() => {
    const detected = detectUserTimezone();
    setDetectedTimezone(detected);

    // If no value is set, use detected timezone
    if (!value && detected) {
      onChange(detected);
    }
  }, []);

  const now = new Date();

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] bg-white appearance-none cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {COMMON_TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
            {showOffset && ` (${getReadableUTCOffset(tz.value, now)})`}
          </option>
        ))}
      </select>

      {/* Dropdown arrow */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#667085]">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Show "detected" indicator if matches */}
      {detectedTimezone === value && (
        <p className="mt-1 text-xs text-[#667085]">
          Detected from your browser
        </p>
      )}
    </div>
  );
}

// Compact version for inline use
export function TimezoneIndicator({
  timezone,
  onClick,
  className = '',
}: {
  timezone: string;
  onClick?: () => void;
  className?: string;
}) {
  const now = new Date();
  const offset = getReadableUTCOffset(timezone, now);
  const label = getTimezoneLabel(timezone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-sm text-[#6F71EE] hover:text-[#5a5cd0] ${className}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{label.split(' ')[0]} ({offset})</span>
    </button>
  );
}
