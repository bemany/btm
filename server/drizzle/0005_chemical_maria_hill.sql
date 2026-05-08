ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "private_owner_id" text;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'projects_private_owner_id_users_id_fk'
  ) THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_private_owner_id_users_id_fk"
      FOREIGN KEY ("private_owner_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;