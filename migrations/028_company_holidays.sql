-- Migration: Company-Wide Holidays
-- Allows defining company holidays that block availability for ALL employees

CREATE TABLE IF NOT EXISTS oh_company_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES oh_admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast date range queries when checking availability
CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON oh_company_holidays(date);
