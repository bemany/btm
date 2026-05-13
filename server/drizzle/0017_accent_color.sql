-- Per-User Accent-Color (Feature F7JzZf65SzX).
-- Hex-Format '#RRGGBB' oder NULL (= globaler BTM-Default Orange).
-- Wird im Frontend bei Mount als CSS-Variable --accent-500 + --accent-600
-- auf document.body gesetzt.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accent_color" text;
