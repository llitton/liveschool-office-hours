-- Booking Analytics: Track conversion funnel from page view to booking
-- Migration: 026_booking_analytics.sql

CREATE TABLE oh_booking_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session tracking (anonymous-first design)
  session_id VARCHAR(64) NOT NULL,  -- Client-generated UUID stored in sessionStorage

  -- Funnel tracking
  event_id UUID REFERENCES oh_events(id) ON DELETE SET NULL,
  slot_id UUID REFERENCES oh_slots(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES oh_bookings(id) ON DELETE SET NULL,

  -- Event classification
  event_type VARCHAR(50) NOT NULL,  -- 'page_view', 'slot_selection', 'form_start', 'form_submit', 'booking_created', 'booking_failed'

  -- Context data (privacy-safe)
  event_slug VARCHAR(255),
  selected_slot_time TIMESTAMPTZ,  -- For slot_selection events

  -- Attribution
  referrer_url TEXT,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),

  -- Device context (privacy-safe, no fingerprinting)
  device_type VARCHAR(20),        -- 'desktop', 'tablet', 'mobile'
  browser_name VARCHAR(50),
  visitor_timezone VARCHAR(100),

  -- Error tracking (for booking_failed events)
  error_code VARCHAR(50),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Denormalized for efficient queries
  event_name VARCHAR(255)
);

-- Indexes for efficient querying
CREATE INDEX idx_booking_analytics_created_at ON oh_booking_analytics(created_at DESC);
CREATE INDEX idx_booking_analytics_event_id ON oh_booking_analytics(event_id);
CREATE INDEX idx_booking_analytics_event_type ON oh_booking_analytics(event_type);
CREATE INDEX idx_booking_analytics_session_id ON oh_booking_analytics(session_id);
CREATE INDEX idx_booking_analytics_event_slug ON oh_booking_analytics(event_slug);

-- Composite index for funnel analysis
CREATE INDEX idx_booking_analytics_funnel ON oh_booking_analytics(event_id, event_type, created_at DESC);

-- Enable RLS
ALTER TABLE oh_booking_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read analytics (admin-only pages)
CREATE POLICY "Allow authenticated read access" ON oh_booking_analytics
  FOR SELECT TO authenticated USING (true);

-- Policy: Service role can insert/update analytics events
CREATE POLICY "Allow service insert" ON oh_booking_analytics
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Allow service update" ON oh_booking_analytics
  FOR UPDATE TO service_role USING (true);

-- Policy: Allow anonymous inserts for public page tracking
CREATE POLICY "Allow anon insert for tracking" ON oh_booking_analytics
  FOR INSERT TO anon WITH CHECK (
    event_type IN ('page_view', 'slot_selection', 'form_start', 'form_submit', 'booking_failed')
  );
