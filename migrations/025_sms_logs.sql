-- SMS Logs table for tracking all SMS messages sent
-- This enables the SMS delivery logs and usage dashboard features

CREATE TABLE oh_sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES oh_bookings(id) ON DELETE SET NULL,
  event_id UUID REFERENCES oh_events(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(20) NOT NULL,
  recipient_name VARCHAR(255),
  message_type VARCHAR(50) NOT NULL, -- 'reminder_24h', 'reminder_1h', 'test', 'custom'
  message_body TEXT NOT NULL,
  character_count INTEGER NOT NULL,
  segment_count INTEGER DEFAULT 1, -- SMS segments (1 segment = 160 chars for GSM)
  status VARCHAR(20) NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'failed'
  provider VARCHAR(50) NOT NULL, -- 'twilio', 'aircall'
  provider_message_id VARCHAR(255), -- SID from Twilio, message ID from provider
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_sms_logs_created_at ON oh_sms_logs(created_at DESC);
CREATE INDEX idx_sms_logs_event_id ON oh_sms_logs(event_id);
CREATE INDEX idx_sms_logs_booking_id ON oh_sms_logs(booking_id);
CREATE INDEX idx_sms_logs_status ON oh_sms_logs(status);
CREATE INDEX idx_sms_logs_message_type ON oh_sms_logs(message_type);

-- Enable RLS
ALTER TABLE oh_sms_logs ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read SMS logs (admin-only pages)
CREATE POLICY "Allow authenticated read access" ON oh_sms_logs
  FOR SELECT TO authenticated USING (true);

-- Policy: Service role can insert/update SMS logs
CREATE POLICY "Allow service insert" ON oh_sms_logs
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Allow service update" ON oh_sms_logs
  FOR UPDATE TO service_role USING (true);
