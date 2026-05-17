-- FCXVQOSTCFp: Checklisten pro Aufgabe.
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_checklist_items_task_idx
  ON task_checklist_items (task_id, sort_order);
