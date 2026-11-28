DO $$ BEGIN
 CREATE TYPE "public"."quiz_placement" AS ENUM('live', 'homework');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."quiz_item_kind" AS ENUM(
  'multiple_choice',
  'checkboxes',
  'true_false',
  'numeric_range',
  'matching',
  'ordering'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "quiz_questions"
  ADD COLUMN IF NOT EXISTS "placement" "quiz_placement" DEFAULT 'live' NOT NULL;
--> statement-breakpoint
ALTER TABLE "quiz_questions"
  ADD COLUMN IF NOT EXISTS "kind" "quiz_item_kind" DEFAULT 'multiple_choice' NOT NULL;
--> statement-breakpoint
ALTER TABLE "quiz_questions"
  ADD COLUMN IF NOT EXISTS "require_explanation" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "quiz_questions"
  ADD COLUMN IF NOT EXISTS "spec" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "quiz_questions"
  ADD COLUMN IF NOT EXISTS "answer_key" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "quiz_questions"
SET
  "kind" = 'multiple_choice',
  "placement" = 'live',
  "require_explanation" = false,
  "spec" = jsonb_build_object('choices', COALESCE("choices", '[]'::jsonb)),
  "answer_key" = jsonb_build_object('correctChoiceId', COALESCE("correct_choice_id", ''))
WHERE "spec" = '{}'::jsonb OR "answer_key" = '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "quiz_questions" DROP COLUMN IF EXISTS "choices";
--> statement-breakpoint
ALTER TABLE "quiz_questions" DROP COLUMN IF EXISTS "correct_choice_id";
--> statement-breakpoint
ALTER TABLE "quiz_attempts"
  ADD COLUMN IF NOT EXISTS "placement" "quiz_placement" DEFAULT 'live' NOT NULL;
--> statement-breakpoint
ALTER TABLE "quiz_attempt_items"
  ADD COLUMN IF NOT EXISTS "response" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "quiz_attempt_items"
SET "response" = jsonb_build_object(
  'kind', 'multiple_choice',
  'questionId', "question_id"::text,
  'choiceId', "choice_id",
  'elapsedSec', COALESCE("time_spent_sec", 0)
)
WHERE "response" = '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "quiz_attempt_items" DROP COLUMN IF EXISTS "choice_id";
