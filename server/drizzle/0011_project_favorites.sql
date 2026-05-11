-- Persönliche Projekt-Favoriten. Komplett user-spezifisch, kein Sharing.
-- PK ist (user_id, project_id) — automatisch via composite PRIMARY KEY.

CREATE TABLE IF NOT EXISTS "project_favorites" (
  "user_id" text NOT NULL,
  "project_id" text NOT NULL,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "project_favorites_pkey" PRIMARY KEY ("user_id", "project_id")
);

DO $$ BEGIN
  ALTER TABLE "project_favorites"
    ADD CONSTRAINT "project_favorites_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "project_favorites"
    ADD CONSTRAINT "project_favorites_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "project_favorites_user_idx" ON "project_favorites" ("user_id");
CREATE INDEX IF NOT EXISTS "project_favorites_proj_idx" ON "project_favorites" ("project_id");
