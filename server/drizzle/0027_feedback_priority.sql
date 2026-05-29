-- FpU3hZAA30w: Priorisierung von Feedbacks im Admin-Screen.
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'med' CHECK (priority IN ('low', 'med', 'high'));

CREATE INDEX IF NOT EXISTS feedback_priority_idx ON feedback (priority, created_at DESC);
