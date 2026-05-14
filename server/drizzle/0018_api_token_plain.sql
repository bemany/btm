-- Klartext-Token-Spalte (intern, FTTMD2R8-LH-Follow-up).
-- BTM ist ein internes Tool ohne externe User; der Datenschutz-Trade-off
-- (Plain Storage statt nur Hash) ist hier akzeptiert, weil das den Claude-
-- MCP-Setup für bestehende Tokens reibungsärmer macht — User sehen ihren
-- Token in den Settings statt ihn neu erstellen zu müssen, sobald sie das
-- frische-Token-Panel einmal weg geklickt haben.
-- Hash bleibt bestehen + ist weiterhin der Auth-Verifikationspfad.
-- Legacy-Tokens haben token_plain = NULL → UI bietet Re-Create-Hinweis.

ALTER TABLE "api_tokens" ADD COLUMN IF NOT EXISTS "token_plain" text;
