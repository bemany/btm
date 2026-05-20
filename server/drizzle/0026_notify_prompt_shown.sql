-- Notify-Prompt nach Login (Onboarding-Wizard fuer Mail-Notifications).
-- 1) Spalte ergaenzen
-- 2) Daily-Digest bei allen bestehenden Usern abschalten (per Esref-Wunsch).
--    Mention-Mails bleiben unveraendert.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_prompt_shown_at timestamp with time zone;

UPDATE users SET notify_digest_mail = false;
