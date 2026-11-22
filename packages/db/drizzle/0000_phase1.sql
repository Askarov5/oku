CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
  CREATE TYPE "public"."book_language" AS ENUM('ky', 'ru');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."book_status" AS ENUM('draft', 'review', 'published');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."book_page_status" AS ENUM('pending', 'extracted', 'reviewed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."ingestion_job_status" AS ENUM('queued', 'running', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "countries" (
  "code" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "config" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "books" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "country_code" text NOT NULL,
  "grade" integer NOT NULL,
  "subject" text NOT NULL,
  "language" "book_language" NOT NULL,
  "title" text NOT NULL,
  "author_name" text,
  "source_pdf_url" text NOT NULL,
  "is_canonical" boolean DEFAULT true NOT NULL,
  "status" "book_status" DEFAULT 'draft' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "book_pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "book_id" uuid NOT NULL,
  "page_number" integer NOT NULL,
  "raw_image_url" text,
  "extracted_json" jsonb,
  "status" "book_page_status" DEFAULT 'pending' NOT NULL,
  "error_message" text,
  "stage" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ingestion_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "book_id" uuid NOT NULL,
  "status" "ingestion_job_status" DEFAULT 'queued' NOT NULL,
  "page_start" integer NOT NULL,
  "page_end" integer NOT NULL,
  "total_pages" integer NOT NULL,
  "completed_pages" integer DEFAULT 0 NOT NULL,
  "failed_pages" integer DEFAULT 0 NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "book_id" uuid NOT NULL,
  "order_index" integer NOT NULL,
  "title" text NOT NULL,
  "quarter" integer,
  "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "books" ADD CONSTRAINT "books_country_code_countries_code_fk"
    FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "book_pages" ADD CONSTRAINT "book_pages_book_id_books_id_fk"
    FOREIGN KEY ("book_id") REFERENCES "public"."books"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_book_id_books_id_fk"
    FOREIGN KEY ("book_id") REFERENCES "public"."books"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "units" ADD CONSTRAINT "units_book_id_books_id_fk"
    FOREIGN KEY ("book_id") REFERENCES "public"."books"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "book_pages_book_id_page_number_idx"
  ON "book_pages" USING btree ("book_id","page_number");
