'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { BookingAnalyticsEventType } from '@/types';

interface AnalyticsContext {
  eventSlug: string;
  eventId?: string;
  eventName?: string;
}

interface TrackEventData {
  slot_id?: string;
  selected_slot_time?: string;
  booking_id?: string;
  error_code?: string;
  error_message?: string;
}

function getDeviceType(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getBrowserName(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  return 'Other';
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = sessionStorage.getItem('oh_analytics_session');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('oh_analytics_session', sessionId);
  }
  return sessionId;
}

export function useBookingAnalytics(context: AnalyticsContext) {
  const sessionIdRef = useRef<string>('');
  const trackedEventsRef = useRef<Set<string>>(new Set());

  // Get or create session ID on mount
  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
  }, []);

  const track = useCallback(async (
    eventType: BookingAnalyticsEventType,
    additionalData?: TrackEventData
  ) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    // Deduplicate certain events per session (page_view, form_start)
    const dedupeKey = `${eventType}-${context.eventSlug}`;
    if (['page_view', 'form_start'].includes(eventType)) {
      if (trackedEventsRef.current.has(dedupeKey)) return;
      trackedEventsRef.current.add(dedupeKey);
    }

    // Collect UTM params from URL
    const searchParams = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

    // Build payload
    const payload = {
      session_id: sessionId,
      event_type: eventType,
      event_slug: context.eventSlug,
      event_id: context.eventId || null,
      event_name: context.eventName || null,
      referrer_url: typeof document !== 'undefined' ? document.referrer || null : null,
      utm_source: searchParams.get('utm_source') || null,
      utm_medium: searchParams.get('utm_medium') || null,
      utm_campaign: searchParams.get('utm_campaign') || null,
      device_type: getDeviceType(),
      browser_name: getBrowserName(),
      visitor_timezone: typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : null,
      ...additionalData,
    };

    // Fire and forget - don't block UI
    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true, // Ensures request completes even on navigation
      });
    } catch {
      // Silent fail - analytics should never break booking flow
    }
  }, [context.eventSlug, context.eventId, context.eventName]);

  const trackPageView = useCallback(() => {
    track('page_view');
  }, [track]);

  const trackSlotSelection = useCallback((slotId: string, slotTime: string) => {
    track('slot_selection', {
      slot_id: slotId,
      selected_slot_time: slotTime
    });
  }, [track]);

  const trackFormStart = useCallback(() => {
    track('form_start');
  }, [track]);

  const trackFormSubmit = useCallback(() => {
    track('form_submit');
  }, [track]);

  const trackBookingCreated = useCallback((bookingId: string) => {
    track('booking_created', { booking_id: bookingId });
  }, [track]);

  const trackBookingFailed = useCallback((errorCode: string, errorMessage: string) => {
    track('booking_failed', {
      error_code: errorCode,
      error_message: errorMessage
    });
  }, [track]);

  // Expose session ID for passing to booking API
  const getSessionId = useCallback(() => {
    return sessionIdRef.current;
  }, []);

  return {
    trackPageView,
    trackSlotSelection,
    trackFormStart,
    trackFormSubmit,
    trackBookingCreated,
    trackBookingFailed,
    getSessionId,
  };
}
