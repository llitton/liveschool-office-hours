'use client';

import { useState } from 'react';

interface SeriesBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (options: { recurrence_pattern: string; total_sessions: number }) => Promise<void>;
  slotDate: string;
  slotTime: string;
}

export default function SeriesBookingModal({
  isOpen,
  onClose,
  onSubmit,
  slotDate,
  slotTime,
}: SeriesBookingModalProps) {
  const [recurrencePattern, setRecurrencePattern] = useState('weekly');
  const [totalSessions, setTotalSessions] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        recurrence_pattern: recurrencePattern,
        total_sessions: totalSessions,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create series');
    } finally {
      setSubmitting(false);
    }
  };

  const getPreviewDates = () => {
    const startDate = new Date(slotDate);
    const dates = [];
    const interval = recurrencePattern === 'biweekly' ? 14 : recurrencePattern === 'monthly' ? 28 : 7;

    for (let i = 0; i < totalSessions; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i * interval);
      dates.push(date);
    }
    return dates;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[#101E57]">Book Recurring Sessions</h2>
            <button
              onClick={onClose}
              className="text-[#667085] hover:text-[#101E57]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-[#667085] mb-6">
            Book multiple sessions at the same time each {recurrencePattern === 'monthly' ? 'month' : 'week'}.
            Starting {slotDate} at {slotTime}.
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-2">
                Frequency
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'biweekly', label: 'Every 2 weeks' },
                  { value: 'monthly', label: 'Monthly' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setRecurrencePattern(option.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      recurrencePattern === option.value
                        ? 'bg-[#6F71EE] text-white'
                        : 'bg-[#F6F6F9] text-[#667085] hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-2">
                Number of Sessions
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={2}
                  max={12}
                  value={totalSessions}
                  onChange={(e) => setTotalSessions(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="w-8 text-center font-medium text-[#101E57]">
                  {totalSessions}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-2">
                Session Dates (Preview)
              </label>
              <div className="bg-[#F6F6F9] rounded-lg p-3 max-h-40 overflow-y-auto">
                <div className="space-y-1">
                  {getPreviewDates().map((date, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span className="w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-xs">
                        {index + 1}
                      </span>
                      <span className="text-[#101E57]">
                        {date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="text-[#667085]">at {slotTime}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-[#667085] mt-2">
                Note: Sessions will only be booked if slots are available at these times.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-[#667085] hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
            >
              {submitting ? 'Booking...' : `Book ${totalSessions} Sessions`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
