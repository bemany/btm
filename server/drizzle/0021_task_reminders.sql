CREATE TABLE IF NOT EXISTS "task_reminders" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "remind_at" timestamp with time zone NOT NULL,
  "notified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "task_reminders_task_id_idx" ON "task_reminders" ("task_id");
CREATE INDEX IF NOT EXISTS "task_reminders_user_id_idx" ON "task_reminders" ("user_id");
CREATE INDEX IF NOT EXISTS "task_reminders_remind_at_idx" ON "task_reminders" ("remind_at") WHERE "notified_at" IS NULL;
