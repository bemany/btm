CREATE TABLE IF NOT EXISTS "comments" (
  "id" text PRIMARY KEY NOT NULL,
  "subject_type" text NOT NULL,
  "subject_id" text NOT NULL,
  "author_id" text NOT NULL,
  "body" text NOT NULL,
  "edited_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comment_mentions" (
  "comment_id" text NOT NULL,
  "user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "actor_id" text,
  "payload" jsonb NOT NULL,
  "seen_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'comments_author_id_users_id_fk'
  ) THEN
    ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk"
      FOREIGN KEY ("author_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'comment_mentions_comment_id_comments_id_fk'
  ) THEN
    ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_comment_id_comments_id_fk"
      FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'comment_mentions_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_actor_id_users_id_fk'
  ) THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk"
      FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_subject_idx" ON "comments" ("subject_type","subject_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_author_idx" ON "comments" ("author_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comment_mentions_user_idx" ON "comment_mentions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comment_mentions_comment_idx" ON "comment_mentions" ("comment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_user_seen_idx" ON "notifications" ("user_id","seen_at","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_user_created_idx" ON "notifications" ("user_id","created_at");
