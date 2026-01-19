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
    connection,
    busyTimes,
    error,
    connectGoogle,
    connectMicrosoft,
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

  if (isConnected && connection) {
    const isGoogle = connection.provider === 'google';
    const providerName = isGoogle ? 'Google Calendar' : 'Outlook';
    const bgColor = isGoogle ? 'bg-[#4285f4]/5' : 'bg-[#6F71EE]/5';
    const borderColor = isGoogle ? 'border-[#4285f4]/20' : 'border-[#6F71EE]/20';
    const iconBgColor = isGoogle ? 'bg-[#4285f4]' : 'bg-[#6F71EE]';

    return (
      <div className={`${bgColor} border ${borderColor} rounded-lg p-4 mb-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 ${iconBgColor} rounded flex items-center justify-center`}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[#101E57]">
                {providerName} connected
              </p>
              <p className="text-xs text-[#667085]">{connection.email}</p>
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
          <svg className="w-5 h-5 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[#101E57] mb-1">
            See your availability
          </p>
          <p className="text-xs text-[#667085] mb-3">
            Connect your calendar to see conflicts while booking.
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Google Calendar button */}
            <button
              onClick={connectGoogle}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-[#101E57] text-sm font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition"
            >
              {/* Google Calendar icon */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12s4.48 10 10 10c5.52 0 10-4.48 10-10zM10.88 17.76l-4.26-4.26 1.42-1.42 2.84 2.84 5.66-5.66 1.42 1.42-7.08 7.08z"/>
                <path fill="#34A853" d="M12 22c5.52 0 10-4.48 10-10h-4c0 3.31-2.69 6-6 6v4z"/>
                <path fill="#FBBC05" d="M2 12c0 5.52 4.48 10 10 10v-4c-3.31 0-6-2.69-6-6H2z"/>
                <path fill="#EA4335" d="M12 2C6.48 2 2 6.48 2 12h4c0-3.31 2.69-6 6-6V2z"/>
                <path fill="#4285F4" d="M22 12c0-5.52-4.48-10-10-10v4c3.31 0 6 2.69 6 6h4z"/>
              </svg>
              Google
            </button>

            {/* Microsoft/Outlook button */}
            <button
              onClick={connectMicrosoft}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-[#101E57] text-sm font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition"
            >
              {/* Microsoft icon */}
              <svg className="w-4 h-4" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Outlook
            </button>
          </div>
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
