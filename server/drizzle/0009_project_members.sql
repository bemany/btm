-- Projekt-Mitgliedschaften und Verantwortlicher.
--
-- projects.owner_id: optionaler Verantwortlicher pro Projekt.
--   - Bekommt eine Inbox-Notification wenn eine Aufgabe nach 'review' wechselt
--   - Nur Owner (oder Admin) darf eine Aufgabe auf 'done' setzen
--
-- project_members: pro (project, user) eine Rolle. Composite-Primary-Key
--   verhindert Duplikate. FK-Cascade auf delete in beide Richtungen.
--   Existenz orthogonal zu privateOwnerId — Privat-Projekte funktionieren
--   wie bisher ohne Members.

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "owner_id" text;

DO $$
BEGIN
  ALTER TABLE "projects"
    ADD CONSTRAINT "projects_owner_id_users_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "project_members" (
  "project_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL DEFAULT 'member',
  "added_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id", "user_id")
);

DO $$
BEGIN
  ALTER TABLE "project_members"
    ADD CONSTRAINT "project_members_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "project_members"
    ADD CONSTRAINT "project_members_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "project_members_pid_idx" ON "project_members" ("project_id");
CREATE INDEX IF NOT EXISTS "project_members_uid_idx" ON "project_members" ("user_id");
