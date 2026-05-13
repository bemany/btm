-- iCal-Feeds als zweite Datenquelle + TV-Privacy-Toggle.
--
-- 1) users.calendar_tv_private — boolean, default false. Wenn true werden
--    eigene Events auf /api/calendar/all anonymisiert (Title "Privat",
--    Location/Attendees entfernt).
-- 2) calendar_events erweitern um source + ical_feed_id, odoo_event_id
--    umbenennen zu external_id. Neuer Unique-Index (user_id,source,ext_id).
-- 3) Neue Tabelle ical_feeds für die per-User-iCal-URLs.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "calendar_tv_private" boolean NOT NULL DEFAULT false;

-- calendar_events: existierende Records bleiben source='odoo' (Default
-- der neuen Spalte erfasst sie automatisch). Spalten-Rename via ALTER.
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'odoo';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "ical_feed_id" text;

-- Rename idempotent: nur wenn alte Spalte noch existiert und neue noch nicht
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='calendar_events' AND column_name='odoo_event_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='calendar_events' AND column_name='external_id'
  ) THEN
    ALTER TABLE "calendar_events" RENAME COLUMN "odoo_event_id" TO "external_id";
  END IF;
END $$;

-- Alten Unique-Index droppen (falls existent), neuen anlegen
DROP INDEX IF EXISTS "cal_events_user_odoo_uid";
CREATE UNIQUE INDEX IF NOT EXISTS "cal_events_user_source_ext"
  ON "calendar_events" ("user_id", "source", "external_id");

-- iCal-Feeds-Tabelle
CREATE TABLE IF NOT EXISTS "ical_feeds" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "url" text NOT NULL,
  "label" text,
  "sync_enabled" boolean NOT NULL DEFAULT true,
  "last_sync_at" timestamp with time zone,
  "last_sync_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "ical_feeds"
    ADD CONSTRAINT "ical_feeds_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ical_feeds_user_idx" ON "ical_feeds" ("user_id");
