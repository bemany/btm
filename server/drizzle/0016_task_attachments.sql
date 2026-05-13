-- Datei-Anhänge an Tasks (Feature FmFsMB3v6rK).
-- Storage im Filesystem (Docker-Volume), in der DB nur Metadata.

CREATE TABLE IF NOT EXISTS "task_attachments" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "uploader_id" text,
  "filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "storage_path" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "task_attachments"
    ADD CONSTRAINT "task_attachments_task_id_tasks_id_fk"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "task_attachments"
    ADD CONSTRAINT "task_attachments_uploader_id_users_id_fk"
    FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "task_attachments_task_idx" ON "task_attachments" ("task_id", "created_at");
