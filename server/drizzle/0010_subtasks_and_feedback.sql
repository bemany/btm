-- Subtasks: optionale parent_task_id pro Task. Self-referencing — keine
-- FK-Constraint, weil das Cascade-Verhalten beim Löschen einer Eltern-
-- Aufgabe je nach UI-Wunsch verschieden sein soll (im Code regeln wir's).

ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "parent_task_id" text;

CREATE INDEX IF NOT EXISTS "tasks_parent_idx" ON "tasks" ("parent_task_id");

-- Feedback (Bug-Reports + Feature-Requests). User-erfasst, Admin-einseh-
-- bar. Status: open / in_progress / done / wontfix.
CREATE TABLE IF NOT EXISTS "feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "context_path" text,
  "context_theme" text,
  "context_user_agent" text,
  "submitter_id" text,
  "status" text NOT NULL DEFAULT 'open',
  "admin_note" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE "feedback"
    ADD CONSTRAINT "feedback_submitter_id_users_id_fk"
    FOREIGN KEY ("submitter_id") REFERENCES "users" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "feedback_status_idx" ON "feedback" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "feedback_submitter_idx" ON "feedback" ("submitter_id");
