CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "push_sub_user_idx" ON "push_subscriptions"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "push_sub_endpoint_idx" ON "push_subscriptions"("endpoint");
