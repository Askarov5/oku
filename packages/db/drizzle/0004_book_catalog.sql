-- A book sits on a category shelf (history, geography, …) and one division of that shelf.
-- Grade is stored only for a school textbook. Existing uploads were all grade 9 geography.

CREATE TABLE IF NOT EXISTS "categories" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "subcategories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" text NOT NULL REFERENCES "categories"("id"),
  "name" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "subcategories_category_name_idx"
  ON "subcategories" ("category_id", lower("name"));

INSERT INTO "categories" ("id", "name") VALUES
  ('geography', 'Geography'),
  ('history', 'History'),
  ('maths', 'Maths'),
  ('physics', 'Physics')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "subcategories" ("category_id", "name")
SELECT category_id, name
FROM (VALUES
  ('geography', 'Political geography'),
  ('geography', 'Physical geography'),
  ('geography', 'Economic geography'),
  ('history', 'World history'),
  ('history', 'History of Kyrgyzstan'),
  ('maths', 'Algebra'),
  ('maths', 'Geometry'),
  ('physics', 'Mechanics')
) AS seed(category_id, name)
WHERE NOT EXISTS (
  SELECT 1 FROM "subcategories" existing
  WHERE existing.category_id = seed.category_id
    AND lower(existing.name) = lower(seed.name)
);

ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "category_id" text;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "subcategory_id" uuid;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "is_school_textbook" boolean DEFAULT false NOT NULL;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "published_year" integer;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "authors" text[] DEFAULT '{}'::text[] NOT NULL;

UPDATE "books"
SET
  "category_id" = 'geography',
  "subcategory_id" = (
    SELECT "id" FROM "subcategories"
    WHERE "category_id" = 'geography' AND lower("name") = lower('Political geography')
  ),
  "is_school_textbook" = true,
  "authors" = CASE
    WHEN "author_name" IS NOT NULL AND btrim("author_name") <> '' THEN ARRAY[btrim("author_name")]::text[]
    ELSE '{}'::text[]
  END
WHERE "category_id" IS NULL;

ALTER TABLE "books" ALTER COLUMN "category_id" SET NOT NULL;
ALTER TABLE "books" ALTER COLUMN "subcategory_id" SET NOT NULL;
ALTER TABLE "books" ALTER COLUMN "grade" DROP NOT NULL;

ALTER TABLE "books" DROP COLUMN IF EXISTS "subject";
ALTER TABLE "books" DROP COLUMN IF EXISTS "author_name";

DO $$ BEGIN
  ALTER TABLE "books"
    ADD CONSTRAINT "books_category_id_categories_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "books"
    ADD CONSTRAINT "books_subcategory_id_subcategories_id_fk"
    FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "books"
    ADD CONSTRAINT "books_school_grade_check"
    CHECK (
      ("is_school_textbook" AND "grade" BETWEEN 1 AND 11)
      OR (NOT "is_school_textbook" AND "grade" IS NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "books"
    ADD CONSTRAINT "books_published_year_check"
    CHECK ("published_year" IS NULL OR "published_year" BETWEEN 1800 AND 2100);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
