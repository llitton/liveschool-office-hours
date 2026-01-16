-- Task Templates: Reusable task checklists for events
-- Allows hosts to define common follow-up tasks that can be quickly applied

CREATE TABLE IF NOT EXISTS oh_task_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES oh_events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  -- When the task should be done: 'before_session', 'during_session', 'after_session'
  timing TEXT DEFAULT 'after_session',
  -- Hours after/before session to set as default due date (null = no due date)
  default_due_offset_hours INTEGER,
  -- If true, automatically create this task for every booking
  auto_create BOOLEAN DEFAULT false,
  -- Order for display
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by event
CREATE INDEX IF NOT EXISTS idx_task_templates_event_id ON oh_task_templates(event_id);

-- Index for auto-create tasks
CREATE INDEX IF NOT EXISTS idx_task_templates_auto_create ON oh_task_templates(event_id, auto_create) WHERE auto_create = true;

-- Add template_id to quick_tasks to track which template it came from
ALTER TABLE oh_quick_tasks ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES oh_task_templates(id) ON DELETE SET NULL;

-- Comments
COMMENT ON TABLE oh_task_templates IS 'Reusable task templates for events';
COMMENT ON COLUMN oh_task_templates.timing IS 'When task should be done: before_session, during_session, after_session';
COMMENT ON COLUMN oh_task_templates.default_due_offset_hours IS 'Hours offset from session time for due date (positive = after, negative = before)';
COMMENT ON COLUMN oh_task_templates.auto_create IS 'If true, automatically create this task for every new booking';
