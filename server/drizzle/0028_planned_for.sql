-- F44rPspkp5z (Phase 2): Multi-Tag-Planung und Trennung Frist vs. Bearbeitungstag.
-- Tasks bekommen ein optionales plannedFor-Array (ISO-Date-Strings). Wenn leer,
-- gilt due weiterhin als Plan-Tag (Backwards-Kompat). Sonst wird die Task in
-- der Timeline an jedem dieser Tage gerendert; due bleibt separat als Frist.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS planned_for jsonb NOT NULL DEFAULT '[]'::jsonb;

-- GIN-Index ermoeglicht spaeter effiziente "welche Tasks am Tag X" Abfragen.
-- Aktuell rechnet das Frontend in-memory; Index kostet aber kaum was.
CREATE INDEX IF NOT EXISTS tasks_planned_for_idx ON tasks USING gin (planned_for);
