-- Multi-Team-Mitgliedschaft (FNoN9074ttK).
-- user_teams ist die N:M-Beziehung User ↔ Team. users.team_id bleibt als
-- 'primary team' für Backwards-Compat — beim Speichern wird sichergestellt
-- dass primary auch in user_teams steht.
-- Bestehende users.team_id-Werte werden in die neue Tabelle gespiegelt,
-- damit nach der Migration die Mehrfach-Zuweisungs-Queries konsistent sind.

CREATE TABLE IF NOT EXISTS "user_teams" (
  "user_id" text NOT NULL,
  "team_id" text NOT NULL,
  "added_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_teams_pkey" PRIMARY KEY ("user_id", "team_id")
);

DO $$ BEGIN
  ALTER TABLE "user_teams"
    ADD CONSTRAINT "user_teams_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_teams"
    ADD CONSTRAINT "user_teams_team_id_teams_id_fk"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "user_teams_user_idx" ON "user_teams" ("user_id");
CREATE INDEX IF NOT EXISTS "user_teams_team_idx" ON "user_teams" ("team_id");

-- Backfill: bestehende users.team_id-Werte in user_teams kopieren.
INSERT INTO "user_teams" ("user_id", "team_id")
SELECT u.id, u.team_id FROM "users" u
WHERE u.team_id IS NOT NULL
ON CONFLICT DO NOTHING;
