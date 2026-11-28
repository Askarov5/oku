DO $$ BEGIN
 CREATE TYPE "public"."lesson_access" AS ENUM('draft', 'private', 'public');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "lessons"
  ADD COLUMN IF NOT EXISTS "access" "lesson_access" DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
UPDATE "lessons"
SET "access" = 'public'
WHERE "is_sample" = true;
