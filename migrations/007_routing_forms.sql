-- Routing Forms: Replace Typeform for intake/triage
-- Users visit /route/[slug], answer questions, get redirected to appropriate event

-- Routing forms table
CREATE TABLE oh_routing_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]',
  default_event_id UUID REFERENCES oh_events(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  submission_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routing rules table
CREATE TABLE oh_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routing_form_id UUID NOT NULL REFERENCES oh_routing_forms(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  answer_value TEXT NOT NULL,
  target_event_id UUID NOT NULL REFERENCES oh_events(id) ON DELETE CASCADE,
  target_host_id UUID REFERENCES oh_admins(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_routing_forms_slug ON oh_routing_forms(slug) WHERE is_active = true;
CREATE INDEX idx_routing_rules_form_id ON oh_routing_rules(routing_form_id) WHERE is_active = true;

-- Enable RLS
ALTER TABLE oh_routing_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE oh_routing_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for routing forms (admins can manage, public can read active)
CREATE POLICY "Admins can manage routing forms" ON oh_routing_forms
  FOR ALL USING (true);

CREATE POLICY "Public can read active routing forms" ON oh_routing_forms
  FOR SELECT USING (is_active = true);

-- RLS policies for routing rules (admins can manage)
CREATE POLICY "Admins can manage routing rules" ON oh_routing_rules
  FOR ALL USING (true);
