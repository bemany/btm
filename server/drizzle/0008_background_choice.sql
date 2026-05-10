-- Animierter Hintergrund pro User (für Glass-Modus). Frontend kennt den
-- Catalog der erlaubten IDs ('none' | 'aurora' | 'mesh' | …). Wenn das
-- Frontend einen unbekannten Wert speichern wollte, fängt der Endpoint
-- das via z.enum ab — die DB-Spalte ist absichtlich text statt enum,
-- damit neue Effekte ohne Migration dazukommen können.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "background_choice" text NOT NULL DEFAULT 'none';
