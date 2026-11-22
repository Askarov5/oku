-- Settings an admin changes while the app runs. The first one is the model
-- that reads pages; the AI worker looks it up when it starts an extraction job.
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "app_settings" ("key", "value") VALUES ('extraction_model', '"gemini/gemini-3.6-flash"');
