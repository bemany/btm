-- Pro iCal-Feed eigene TV-Privacy-Flag. Default false (= öffentlich auf TV).
-- Ergänzt das bestehende users.calendar_tv_private (das jetzt nur noch
-- Odoo-Events betrifft).

ALTER TABLE "ical_feeds" ADD COLUMN IF NOT EXISTS "tv_private" boolean NOT NULL DEFAULT false;
