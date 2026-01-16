-- User onboarding progress tracking
-- Stores state for welcome checklist, tooltips, and tour

ALTER TABLE oh_admins
ADD COLUMN IF NOT EXISTS onboarding_progress JSONB DEFAULT '{
  "welcomeSeen": false,
  "tourCompleted": false,
  "tourStep": null,
  "checklistDismissed": false,
  "tooltipsDismissed": [],
  "completedSteps": []
}'::jsonb;

-- Add index for querying users who haven't completed onboarding
CREATE INDEX IF NOT EXISTS idx_admins_onboarding_incomplete
ON oh_admins((onboarding_progress->>'tourCompleted'))
WHERE (onboarding_progress->>'tourCompleted')::boolean = false;
