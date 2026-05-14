-- Optionaler Screenshot im Feedback-Modal (drag&drop / clipboard-paste).
-- Datenformat: Data-URI 'data:image/...;base64,...' — gleiches Pattern wie
-- users.image. Speicherung inline, weil Feedbacks selten sind und max-
-- Limits (8 MB base64) das Postgres-Volumen nicht sprengen.

ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "screenshot_base64" text;
