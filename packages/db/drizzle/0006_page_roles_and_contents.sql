-- Page roles for role-specific extraction prompts.
DO $$ BEGIN
  CREATE TYPE "public"."book_page_role" AS ENUM(
    'body',
    'table_of_contents',
    'cover',
    'glossary',
    'appendix',
    'answers'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "book_pages" ADD COLUMN IF NOT EXISTS "page_role" "book_page_role" DEFAULT 'body' NOT NULL;
--> statement-breakpoint
-- Digitize range and two-phase conversion gate on the book.
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "digitize_page_start" integer;
--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "digitize_page_end" integer;
--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "contents_outline" jsonb;
--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "body_conversion_queued" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
-- Exact page list for non-contiguous Phase 1 / Phase 2 jobs.
ALTER TABLE "ingestion_jobs" ADD COLUMN IF NOT EXISTS "page_numbers" integer[];
--> statement-breakpoint
-- Drop legacy contents page range columns if an earlier draft migration added them.
ALTER TABLE "books" DROP COLUMN IF EXISTS "contents_page_start";
--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN IF EXISTS "contents_page_end";
