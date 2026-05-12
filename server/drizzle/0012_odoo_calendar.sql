-- Odoo-Calendar-Sync: per-user Credentials auf users + Cache-Tabelle für Events.
-- Read-only-MVP (kein Write-Back nach Odoo). Sync läuft als Scheduler-Tick
-- alle 5 Min in server/src/lib/calendar-sync.ts.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "odoo_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "odoo_database" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "odoo_username" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "odoo_api_key_enc" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "odoo_api_key_iv" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "odoo_uid" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "odoo_partner_id" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "odoo_sync_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "odoo_last_sync_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "odoo_last_sync_error" text;

CREATE TABLE IF NOT EXISTS "calendar_events" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "odoo_event_id" text NOT NULL,
  "title" text NOT NULL,
  "location" text,
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "all_day" boolean NOT NULL DEFAULT false,
  "attendee_count" integer NOT NULL DEFAULT 0,
  "organizer_name" text,
  "synced_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "calendar_events"
    ADD CONSTRAINT "calendar_events_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "cal_events_user_start_idx" ON "calendar_events" ("user_id", "start_at");
CREATE INDEX IF NOT EXISTS "cal_events_start_idx" ON "calendar_events" ("start_at");
CREATE UNIQUE INDEX IF NOT EXISTS "cal_events_user_odoo_uid" ON "calendar_events" ("user_id", "odoo_event_id");
