'use client';

import { useEffect } from 'react';
import { useAttendeeCalendar, BusyTimeBlock } from '@/hooks/useAttendeeCalendar';

interface AttendeeCalendarConnectProps {
  startDate: string; // ISO string for range start
  endDate: string; // ISO string for range end
  onBusyTimesChange: (busyTimes: BusyTimeBlock[]) => void;
}

export function AttendeeCalendarConnect({
  startDate,
  endDate,
  onBusyTimesChange,
}: AttendeeCalendarConnectProps) {
  const {
    isConnected,
    isLoading,
    email,
    busyTimes,
    error,
    connect,
    disconnect,
    fetchBusyTimes,
  } = useAttendeeCalendar();

  // Fetch busy times when connected or date range changes
  useEffect(() => {
    if (isConnected && startDate && endDate) {
      fetchBusyTimes(startDate, endDate);
    }
  }, [isConnected, startDate, endDate, fetchBusyTimes]);

  // Notify parent when busy times change
  useEffect(() => {
    onBusyTimesChange(busyTimes);
  }, [busyTimes, onBusyTimesChange]);

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="bg-[#6F71EE]/5 border border-[#6F71EE]/20 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#6F71EE] rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[#101E57]">
                Outlook connected
              </p>
              <p className="text-xs text-[#667085]">{email}</p>
            </div>
          </div>
          <button
            onClick={disconnect}
            className="text-xs text-[#667085] hover:text-[#101E57] transition"
          >
            Disconnect
          </button>
        </div>
        {busyTimes.length > 0 && (
          <p className="text-xs text-[#667085] mt-2 flex items-center gap-1">
            <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Conflicts with your calendar are highlighted below
          </p>
        )}
        {error && (
          <p className="text-xs text-red-500 mt-2">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-[#F6F6F9] rounded flex items-center justify-center flex-shrink-0">
          {/* Microsoft/Outlook icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#0078D4"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#0078D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[#101E57] mb-1">
            See your availability
          </p>
          <p className="text-xs text-[#667085] mb-3">
            Connect your Outlook calendar to see conflicts while booking.
          </p>
          <button
            onClick={connect}
            className="inline-flex items-center gap-2 px-3 py-2 bg-[#0078D4] text-white text-sm font-medium rounded-lg hover:bg-[#106EBE] transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.17 2.06A2 2 0 0019.5 2h-15a2 2 0 00-2 2v16a2 2 0 002 2h15a2 2 0 002-2V4a2 2 0 00-1.33-1.94zM12 17.5l-5-3 5-3 5 3-5 3z"/>
            </svg>
            Connect Outlook
          </button>
          <p className="text-[10px] text-[#667085] mt-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            We only check free/busy status. Your calendar is never stored.
          </p>
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-3">{error}</p>
      )}
    </div>
  );
}

export { type BusyTimeBlock };
