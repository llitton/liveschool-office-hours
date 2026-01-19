'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface BusyTimeBlock {
  start: string;
  end: string;
}

export type CalendarProvider = 'google' | 'microsoft';

interface CalendarConnection {
  provider: CalendarProvider;
  email: string;
}

interface UseAttendeeCalendarReturn {
  isConnected: boolean;
  isLoading: boolean;
  connection: CalendarConnection | null;
  busyTimes: BusyTimeBlock[];
  error: string | null;
  connectGoogle: () => void;
  connectMicrosoft: () => void;
  disconnect: () => Promise<void>;
  fetchBusyTimes: (start: string, end: string) => Promise<void>;
}

export function useAttendeeCalendar(): UseAttendeeCalendarReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [busyTimes, setBusyTimes] = useState<BusyTimeBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  // Check connection status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  // Listen for OAuth callback messages from popup (both providers)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Handle Microsoft callback
      if (event.data?.type === 'microsoft-calendar-auth') {
        if (event.data.success) {
          setIsConnected(true);
          setConnection({
            provider: 'microsoft',
            email: event.data.email || '',
          });
          setError(null);
        } else {
          setError(event.data.error || 'Connection failed');
        }
        popupRef.current = null;
      }

      // Handle Google callback
      if (event.data?.type === 'google-calendar-auth') {
        if (event.data.success) {
          setIsConnected(true);
          setConnection({
            provider: 'google',
            email: event.data.email || '',
          });
          setError(null);
        } else {
          setError(event.data.error || 'Connection failed');
        }
        popupRef.current = null;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkStatus = async () => {
    try {
      setIsLoading(true);

      // Check both providers in parallel
      const [msResponse, googleResponse] = await Promise.all([
        fetch('/api/attendee-calendar/status'),
        fetch('/api/attendee-calendar/google?action=status'),
      ]);

      const msData = await msResponse.json();
      const googleData = await googleResponse.json();

      // Prefer whichever is connected (Microsoft first if both)
      if (msData.connected) {
        setIsConnected(true);
        setConnection({
          provider: 'microsoft',
          email: msData.email || '',
        });
      } else if (googleData.connected) {
        setIsConnected(true);
        setConnection({
          provider: 'google',
          email: googleData.email || '',
        });
      } else {
        setIsConnected(false);
        setConnection(null);
      }
    } catch (err) {
      console.error('Error checking calendar status:', err);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const openPopup = (url: string) => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      'calendar-auth',
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (popup) {
      popupRef.current = popup;
      popup.focus();
    } else {
      setError('Popup blocked. Please allow popups for this site.');
    }
  };

  const connectGoogle = useCallback(() => {
    openPopup('/api/attendee-calendar/google');
  }, []);

  const connectMicrosoft = useCallback(() => {
    openPopup('/api/attendee-calendar/auth');
  }, []);

  const disconnect = useCallback(async () => {
    try {
      if (connection?.provider === 'google') {
        await fetch('/api/attendee-calendar/google?action=disconnect', { method: 'POST' });
      } else {
        await fetch('/api/attendee-calendar/disconnect', { method: 'POST' });
      }
      setIsConnected(false);
      setConnection(null);
      setBusyTimes([]);
      setError(null);
    } catch (err) {
      console.error('Error disconnecting calendar:', err);
      setError('Failed to disconnect');
    }
  }, [connection]);

  const fetchBusyTimes = useCallback(async (start: string, end: string) => {
    if (!isConnected || !connection) return;

    try {
      const url = connection.provider === 'google'
        ? `/api/attendee-calendar/google?action=busy&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
        : `/api/attendee-calendar/busy?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        if (data.connected === false) {
          setIsConnected(false);
          setConnection(null);
          setBusyTimes([]);
          setError(data.error || 'Session expired');
        } else {
          setError(data.error || 'Failed to fetch calendar');
        }
        return;
      }

      setBusyTimes(data.busy || []);
      setError(null);

      // Update email if returned
      if (data.email && connection) {
        setConnection(prev => prev ? { ...prev, email: data.email } : null);
      }
    } catch (err) {
      console.error('Error fetching busy times:', err);
      setError('Failed to fetch calendar');
    }
  }, [isConnected, connection]);

  return {
    isConnected,
    isLoading,
    connection,
    busyTimes,
    error,
    connectGoogle,
    connectMicrosoft,
    disconnect,
    fetchBusyTimes,
  };
}
