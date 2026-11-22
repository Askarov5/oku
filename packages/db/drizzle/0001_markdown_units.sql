-- Pages become continuous Markdown interrupted only by components, and units
-- keep their header apart from their body.

-- 1. Reshape stored pages. Runs of heading/paragraph/table/callout/exercise
--    blocks merge into one `markdown` block; a level-1 heading becomes a
--    `unit_header`; the trailing `page_break` goes, since the page itself is
--    now the anchor. Pages already in the new shape are left alone.
WITH elems AS (
  SELECT
    bp.id AS page_id,
    t.ord,
    t.b,
    CASE
      WHEN t.b->>'type' = 'image' THEN 'image'
      WHEN t.b->>'type' = 'unit_header' THEN 'unit_header'
      WHEN t.b->>'type' = 'heading' AND (t.b->>'level')::int = 1 THEN 'unit_header'
      ELSE 'markdown'
    END AS kind,
    CASE
      WHEN t.b->>'type' = 'heading'
        THEN repeat('#', (t.b->>'level')::int) || ' ' || (t.b->>'text')
      WHEN t.b->>'type' = 'table' AND coalesce(t.b->>'caption', '') <> ''
        THEN (t.b->>'markdown') || E'\n\n' || (t.b->>'caption')
      ELSE t.b->>'markdown'
    END AS md
  FROM "book_pages" bp,
    jsonb_array_elements(bp."extracted_json"->'blocks') WITH ORDINALITY AS t(b, ord)
  WHERE bp."extracted_json" IS NOT NULL
    AND NOT (bp."extracted_json" ? 'printedPage')
    AND t.b->>'type' <> 'page_break'
),
islands AS (
  SELECT
    *,
    ord - row_number() OVER (PARTITION BY page_id, kind ORDER BY ord) AS island
  FROM elems
),
merged AS (
  SELECT
    page_id,
    kind,
    min(ord) AS ord,
    (array_agg(b ORDER BY ord))[1] AS first_block,
    string_agg(md, E'\n\n' ORDER BY ord) AS md
  FROM islands
  GROUP BY page_id, kind, CASE WHEN kind = 'markdown' THEN island ELSE -ord END
),
rebuilt AS (
  SELECT
    page_id,
    jsonb_agg(
      CASE kind
        WHEN 'image' THEN first_block
        WHEN 'unit_header' THEN jsonb_build_object(
          'id', first_block->>'id',
          'type', 'unit_header',
          'title', coalesce(first_block->>'title', first_block->>'text')
        )
        ELSE jsonb_build_object(
          'id', first_block->>'id',
          'type', 'markdown',
          'markdown', md
        )
      END
      ORDER BY ord
    ) AS blocks
  FROM merged
  GROUP BY page_id
)
UPDATE "book_pages" bp
SET "extracted_json" = (bp."extracted_json" - 'blocks') || jsonb_build_object(
  'blocks', coalesce(r.blocks, '[]'::jsonb),
  'printedPage', NULL,
  'continuesFromPrevious', false
)
FROM "book_pages" src
LEFT JOIN rebuilt r ON r.page_id = src.id
WHERE bp.id = src.id
  AND src."extracted_json" IS NOT NULL
  AND NOT (src."extracted_json" ? 'printedPage');

-- 2. Units published in the old shape cannot be converted in place: they are
--    rebuilt from pages on the next Publish. Their books go back to review.
UPDATE "books" SET "status" = 'review', "updated_at" = now()
WHERE "status" = 'published';

DELETE FROM "units";

ALTER TABLE "units" DROP COLUMN "title";
ALTER TABLE "units" DROP COLUMN "blocks";
ALTER TABLE "units" ADD COLUMN "header" jsonb NOT NULL;
ALTER TABLE "units" ADD COLUMN "body" jsonb DEFAULT '[]'::jsonb NOT NULL;
