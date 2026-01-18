'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface BusyTimeBlock {
  start: string;
  end: string;
}

interface UseAttendeeCalendarReturn {
  isConnected: boolean;
  isLoading: boolean;
  email: string | null;
  busyTimes: BusyTimeBlock[];
  error: string | null;
  connect: () => void;
  disconnect: () => Promise<void>;
  fetchBusyTimes: (start: string, end: string) => Promise<void>;
}

export function useAttendeeCalendar(): UseAttendeeCalendarReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [busyTimes, setBusyTimes] = useState<BusyTimeBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  // Check connection status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  // Listen for OAuth callback message from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'microsoft-calendar-auth') {
        if (event.data.success) {
          setIsConnected(true);
          setEmail(event.data.email || null);
          setError(null);
        } else {
          setError(event.data.error || 'Connection failed');
        }
        // Close popup reference
        popupRef.current = null;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/attendee-calendar/status');
      const data = await response.json();

      setIsConnected(data.connected);
      setEmail(data.email || null);
    } catch (err) {
      console.error('Error checking calendar status:', err);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const connect = useCallback(() => {
    // Open popup for OAuth
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      '/api/attendee-calendar/auth',
      'microsoft-calendar-auth',
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (popup) {
      popupRef.current = popup;
      popup.focus();
    } else {
      setError('Popup blocked. Please allow popups for this site.');
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await fetch('/api/attendee-calendar/disconnect', { method: 'POST' });
      setIsConnected(false);
      setEmail(null);
      setBusyTimes([]);
      setError(null);
    } catch (err) {
      console.error('Error disconnecting calendar:', err);
      setError('Failed to disconnect');
    }
  }, []);

  const fetchBusyTimes = useCallback(async (start: string, end: string) => {
    if (!isConnected) return;

    try {
      const response = await fetch(
        `/api/attendee-calendar/busy?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      );
      const data = await response.json();

      if (!response.ok) {
        if (data.connected === false) {
          // Session expired
          setIsConnected(false);
          setEmail(null);
          setBusyTimes([]);
          setError(data.error || 'Session expired');
        } else {
          setError(data.error || 'Failed to fetch calendar');
        }
        return;
      }

      setBusyTimes(data.busy || []);
      setError(null);

      // Update email if returned (in case token was refreshed)
      if (data.email) {
        setEmail(data.email);
      }
    } catch (err) {
      console.error('Error fetching busy times:', err);
      setError('Failed to fetch calendar');
    }
  }, [isConnected]);

  return {
    isConnected,
    isLoading,
    email,
    busyTimes,
    error,
    connect,
    disconnect,
    fetchBusyTimes,
  };
}
