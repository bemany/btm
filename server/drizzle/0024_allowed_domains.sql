-- Fm16BUutfUO: E-Mail-Domains für Self-Registration.
CREATE TABLE IF NOT EXISTS allowed_domains (
  id text PRIMARY KEY,
  domain text NOT NULL UNIQUE,
  added_by_id text REFERENCES "users"("id") ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
