-- Mail-Notification-Präferenzen pro User.
--
-- notify_mentions_mail: schickt eine Sofort-Mail wenn der User in einem
--   Kommentar mit @ erwähnt wird. Default an.
-- notify_digest_mail: schickt einen Tagesdigest mit ungelesenen Mentions,
--   fälligen Tasks und Activity auf eigenen Tasks. Default an.
-- digest_last_sent_at: Tracking-Feld vom Scheduler, NULL bei neuen Usern.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "notify_mentions_mail" boolean NOT NULL DEFAULT true;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "notify_digest_mail" boolean NOT NULL DEFAULT true;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "digest_last_sent_at" timestamp with time zone;
