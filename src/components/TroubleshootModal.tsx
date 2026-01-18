'use client';

import { useState, useEffect } from 'react';
import { format, addDays, parseISO } from 'date-fns';

interface TroubleshootSlot {
  start_time: string;
  end_time: string;
  code: string;
  reason: string;
  details?: string;
}

interface TroubleshootData {
  date: string;
  day_name: string;
  event: {
    name: string;
    duration_minutes: number;
    meeting_type: string;
    min_notice_hours: number;
    booking_window_days: number;
    buffer_before: number;
    buffer_after: number;
  };
  host: {
    calendar_connected: boolean;
    max_meetings_per_day: number | null;
    max_meetings_per_week: number | null;
    daily_count: number;
    weekly_count: number;
  };
  slots: TroubleshootSlot[];
  summary: {
    total_slots: number;
    available: number;
    blocked: number;
    top_blocking_reason: { code: string; count: number } | null;
    code?: string;
    reason?: string;
  };
}

const CODE_INFO: Record<string, { label: string; color: string; bg: string; fix: string }> = {
  AVAILABLE: {
    label: 'Available',
    color: 'text-green-700',
    bg: 'bg-green-100',
    fix: 'This time can be booked!',
  },
  NOAVAILABILITY: {
    label: 'No Availability',
    color: 'text-red-700',
    bg: 'bg-red-100',
    fix: 'Set your weekly availability in Settings',
  },
  OUTSIDEHOURS: {
    label: 'Outside Hours',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    fix: 'Add availability for this day in Settings',
  },
  CALENDAR: {
    label: 'Calendar Busy',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    fix: 'Change the calendar event to "Free" or remove it',
  },
  NOCAL: {
    label: 'No Calendar',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    fix: 'Connect your Google Calendar in Settings',
  },
  TOOSOON: {
    label: 'Too Soon',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    fix: 'Adjust minimum notice hours in event settings',
  },
  TOOLATE: {
    label: 'Too Far Out',
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    fix: 'Adjust booking window days in event settings',
  },
  BUFFER: {
    label: 'Buffer Time',
    color: 'text-indigo-700',
    bg: 'bg-indigo-100',
    fix: 'Adjust buffer settings or reschedule nearby meeting',
  },
  BOOKED: {
    label: 'Already Booked',
    color: 'text-red-700',
    bg: 'bg-red-100',
    fix: 'This time already has a booking',
  },
  DAILYMAX: {
    label: 'Daily Limit',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    fix: 'Increase daily meeting limit in Settings',
  },
  WEEKLYMAX: {
    label: 'Weekly Limit',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    fix: 'Increase weekly meeting limit in Settings',
  },
  NOHOST: {
    label: 'No Host',
    color: 'text-red-700',
    bg: 'bg-red-100',
    fix: 'Configure a host for this event',
  },
  PAST: {
    label: 'Past',
    color: 'text-gray-500',
    bg: 'bg-gray-50',
    fix: 'This time has already passed',
  },
};

interface TroubleshootModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TroubleshootModal({ eventId, isOpen, onClose }: TroubleshootModalProps) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [data, setData] = useState<TroubleshootData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && selectedDate) {
      fetchTroubleshoot();
    }
  }, [isOpen, selectedDate, eventId]);

  const fetchTroubleshoot = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/events/${eventId}/troubleshoot?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch troubleshoot data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Generate date options for the next 14 days
  const dateOptions: string[] = [];
  for (let i = 0; i < 14; i++) {
    dateOptions.push(format(addDays(new Date(), i), 'yyyy-MM-dd'));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#101E57]">Troubleshoot Availability</h2>
              <p className="text-sm text-[#667085] mt-1">
                See why times are available or blocked
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Date picker */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-[#101E57] mb-2">Select Date</label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {dateOptions.map((date) => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    selectedDate === date
                      ? 'bg-[#6F71EE] text-white'
                      : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                  }`}
                >
                  <div>{format(parseISO(date), 'EEE')}</div>
                  <div className="text-xs">{format(parseISO(date), 'MMM d')}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6F71EE]" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          ) : data ? (
            <div>
              {/* Summary */}
              {data.summary.code ? (
                // Day-level issue (no availability at all)
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-medium text-amber-800">{data.summary.reason}</p>
                      {CODE_INFO[data.summary.code] && (
                        <p className="text-sm text-amber-700 mt-1">
                          <strong>Fix:</strong> {CODE_INFO[data.summary.code].fix}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Normal summary
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{data.summary.available}</div>
                    <div className="text-sm text-green-600">Available</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-700">{data.summary.blocked}</div>
                    <div className="text-sm text-gray-600">Blocked</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-700">{data.summary.total_slots}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                </div>
              )}

              {/* Top blocking reason */}
              {data.summary.top_blocking_reason && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>Most common issue:</strong>{' '}
                    {CODE_INFO[data.summary.top_blocking_reason.code]?.label || data.summary.top_blocking_reason.code}{' '}
                    ({data.summary.top_blocking_reason.count} times)
                  </p>
                  {CODE_INFO[data.summary.top_blocking_reason.code] && (
                    <p className="text-sm text-blue-700 mt-1">
                      <strong>Fix:</strong> {CODE_INFO[data.summary.top_blocking_reason.code].fix}
                    </p>
                  )}
                </div>
              )}

              {/* Event info */}
              <div className="text-sm text-[#667085] mb-4">
                <strong>{data.day_name}</strong> · {data.event.duration_minutes} min meetings ·{' '}
                {data.event.min_notice_hours}h notice · {data.event.booking_window_days} day window
                {(data.event.buffer_before > 0 || data.event.buffer_after > 0) && (
                  <> · {data.event.buffer_before}/{data.event.buffer_after}min buffers</>
                )}
              </div>

              {/* Time slots */}
              {data.slots.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="font-medium text-[#101E57] mb-3">Time Slots</h3>
                  <div className="grid gap-2">
                    {data.slots.map((slot, i) => {
                      const info = CODE_INFO[slot.code] || {
                        label: slot.code,
                        color: 'text-gray-600',
                        bg: 'bg-gray-100',
                        fix: slot.reason,
                      };
                      return (
                        <div
                          key={i}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            slot.code === 'AVAILABLE' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm text-[#101E57]">
                              {format(parseISO(slot.start_time), 'h:mm a')}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${info.bg} ${info.color}`}>
                              {info.label}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-[#667085]">{slot.reason}</p>
                            {slot.details && (
                              <p className="text-xs text-[#98A2B3]">{slot.details}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-center text-[#667085] py-8">
                  No time slots to analyze for this day
                </p>
              )}

              {/* Legend */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-medium text-[#101E57] mb-3">Code Reference</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(CODE_INFO).slice(0, 8).map(([code, info]) => (
                    <div key={code} className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded ${info.bg} ${info.color}`}>
                        {info.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-[#6F71EE] text-white rounded-lg font-medium hover:bg-[#5a5cd0] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
