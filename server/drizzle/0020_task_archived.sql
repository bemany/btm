-- Archiv-Funktion für erledigte Aufgaben (FgPjnOpBdCX).
-- archivedAt=NULL → aktiv, alles andere → archiviert. Default-Listen
-- filtern archivierte raus, Admin-/Times-Screens können sie auf Wunsch
-- einblenden. Archivieren ist nur für tasks in column='done' erlaubt
-- (Server-side guard, UI-Button zeigt sich nur dort).

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "tasks_archived_idx" ON "tasks" ("archived_at");
