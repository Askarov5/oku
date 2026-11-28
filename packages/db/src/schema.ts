import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const bookLanguageEnum = pgEnum("book_language", ["ky", "ru"]);
export const bookStatusEnum = pgEnum("book_status", [
  "draft",
  "review",
  "published",
]);
export const bookPageStatusEnum = pgEnum("book_page_status", [
  "pending",
  "extracted",
  "reviewed",
  "failed",
  /** Kept on the book from the original PDF; not sent to AI yet. */
  "stored",
]);
/** How a page is extracted: body lessons, or a special front/back-matter role. */
export const bookPageRoleEnum = pgEnum("book_page_role", [
  "body",
  "table_of_contents",
  "cover",
  "glossary",
  "appendix",
  "answers",
]);
export const ingestionJobStatusEnum = pgEnum("ingestion_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

/** One line of a saved table of contents (mirrors ContentsEntry in shared-types). */
export interface ContentsEntryJson {
  title: string;
  level: number;
  printedPage: string;
}

export interface CountryConfigJson {
  languages: Array<"ky" | "ru">;
  gradeRange: [number, number];
  calendar: "4_quarters" | "2_semesters";
  gradingScale: {
    type: "5_point" | "10_point" | "100_point";
    thresholds?: number[];
  };
  nationalExam: string;
}

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const subcategories = pgTable("subcategories", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  name: text("name").notNull(),
});

export const countries = pgTable("countries", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  config: jsonb("config").$type<CountryConfigJson>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const books = pgTable("books", {
  id: uuid("id").defaultRandom().primaryKey(),
  countryCode: text("country_code")
    .notNull()
    .references(() => countries.code),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  subcategoryId: uuid("subcategory_id")
    .notNull()
    .references(() => subcategories.id),
  /** Grade is set only when this is a school textbook. */
  isSchoolTextbook: boolean("is_school_textbook").notNull().default(false),
  grade: integer("grade"),
  publishedYear: integer("published_year"),
  authors: text("authors").array().notNull(),
  language: bookLanguageEnum("language").notNull(),
  title: text("title").notNull(),
  /** The uploaded PDF, stored unchanged. */
  sourcePdfUrl: text("source_pdf_url").notNull(),
  /** First page of the PDF as an image, made at upload. Null for books uploaded without one. */
  coverImageUrl: text("cover_image_url"),
  isCanonical: boolean("is_canonical").notNull().default(true),
  status: bookStatusEnum("status").notNull().default("draft"),
  /** Digitize range chosen at upload; used when Phase 2 queues body pages. */
  digitizePageStart: integer("digitize_page_start"),
  digitizePageEnd: integer("digitize_page_end"),
  /**
   * Reviewed or auto-seeded table of contents. Null until TOC pages are
   * extracted or an admin saves one by hand.
   */
  contentsOutline: jsonb("contents_outline").$type<ContentsEntryJson[] | null>(),
  /**
   * False while special pages run first and body conversion waits for review.
   * True once body pages are queued (or when no specials were set).
   */
  bodyConversionQueued: boolean("body_conversion_queued").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const bookPages = pgTable(
  "book_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    /** Extraction prompt role; body is the default for lesson pages. */
    pageRole: bookPageRoleEnum("page_role").notNull().default("body"),
    rawImageUrl: text("raw_image_url"),
    extractedJson: jsonb("extracted_json"),
    status: bookPageStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    stage: text("stage"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    bookPageUnique: uniqueIndex("book_pages_book_id_page_number_idx").on(
      table.bookId,
      table.pageNumber,
    ),
  }),
);

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  status: ingestionJobStatusEnum("status").notNull().default("queued"),
  pageStart: integer("page_start").notNull(),
  pageEnd: integer("page_end").notNull(),
  /**
   * Exact PDF pages for this job when non-contiguous (Phase 1 specials).
   * Null means use pageStart..pageEnd as before.
   */
  pageNumbers: integer("page_numbers").array(),
  totalPages: integer("total_pages").notNull(),
  completedPages: integer("completed_pages").notNull().default(0),
  failedPages: integer("failed_pages").notNull().default(0),
  error: text("error"),
  /**
   * Optional reviewer note for this job only. Appended to the extraction
   * prompt so a retry can correct what the last read missed.
   */
  instruction: text("instruction"),
  /**
   * Optional LiteLLM model for this job only. When set, the worker uses it
   * instead of the global extraction_model setting.
   */
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/** Mirrors `UnitHeader` in @oku/shared-types. */
export interface UnitHeaderJson {
  title: string;
  /** 1 a chapter through 6 a subsection. Absent on units published before levels. */
  level?: number;
  /** Page range by position in the source PDF. */
  pageStart: number;
  pageEnd: number;
  /** The same range as printed on the pages; null where a page carries no number. */
  pageStartLabel: string | null;
  pageEndLabel: string | null;
  /** Absent or "body" for lesson units; otherwise a front/back-matter kind. */
  kind?: "body" | "cover" | "glossary" | "appendix" | "answers";
}

/*
 * A unit keeps its header apart from its body. The header feeds the table of
 * contents and the title above the unit; the body is Markdown interrupted by
 * components and page anchors (`UnitBlock[]` in @oku/shared-types).
 */
export const units = pgTable("units", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  quarter: integer("quarter"),
  header: jsonb("header").$type<UnitHeaderJson>().notNull(),
  body: jsonb("body").$type<unknown[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Settings an admin changes while the app runs, one row per setting. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * The model that reads pages, as a LiteLLM id ("gemini/gemini-3.6-flash",
 * or "openai/…" / "anthropic/…" when that provider's API key is set).
 * The AI worker looks it up when it starts an extraction job.
 */
export const EXTRACTION_MODEL_SETTING = "extraction_model";

/* --- Light accounts & Lesson Studio --- */

export const userRoleEnum = pgEnum("user_role", ["teacher", "student"]);

export const lessonStageEnum = pgEnum("lesson_stage", [
  "generating_plan",
  "review_plan",
  "generating_materials",
  "studio",
  "failed",
]);

export const lessonJobKindEnum = pgEnum("lesson_job_kind", [
  "plan",
  "materials",
]);

export const lessonJobStatusEnum = pgEnum("lesson_job_status", [
  "queued",
  "running",
  "done",
  "failed",
]);

export const lessonAssetKindEnum = pgEnum("lesson_asset_kind", [
  "image",
  "pdf",
  "note",
]);

export const learningEventTypeEnum = pgEnum("learning_event_type", [
  "quiz_completed",
]);

export const quizPlacementEnum = pgEnum("quiz_placement", ["live", "homework"]);

export const quizItemKindEnum = pgEnum("quiz_item_kind", [
  "multiple_choice",
  "checkboxes",
  "true_false",
  "numeric_range",
  "matching",
  "ordering",
]);

export interface LessonDeliverablesJson {
  slides: boolean;
  kahootTest: boolean;
  homework: boolean;
  /** Teaching slides to generate (1–10). Quiz-launch slide is extra. */
  slideCount?: number;
  /** Live quiz questions to generate (1–10). */
  quizCount?: number;
  /** Homework practice items to generate (1–10). */
  homeworkCount?: number;
}

export interface LessonPlanBlockJson {
  id: string;
  lessonNumber: number;
  title: string;
  minutes: number;
  pageRef: string | null;
  explanation: string;
  teacherNote: string;
}

export interface LessonSlideJson {
  id: string;
  kind: "concept" | "worked_example" | "uploaded_media" | "quiz_launch";
  lessonNumber: number;
  title: string;
  bullets: string[];
  formulaOrCallout: string | null;
  pageRef: string | null;
  imageUrl: string | null;
  imageCaption: string | null;
  speakerNotes: string;
}

export interface HomeworkItemJson {
  id: string;
  title: string;
  prompt: string;
  expectedMinutes: number;
  answerGuide: string;
}

export interface LessonGroundingJson {
  bookTitle: string;
  language: string;
  grade: number | null;
  unitTitle: string;
  pageRangeLabel: string;
  summary: string;
  keyTerms: string[];
  markdownExcerpt: string;
  figures: Array<{
    caption: string;
    description: string;
    pageLabel: string;
  }>;
  audience: string;
  amountOfLessons: number;
  minutesPerLesson: number;
  creativeAngle: string;
  noteAttachments: string[];
}

export type QuizPlacement = "live" | "homework";

export type QuizItemKind =
  | "multiple_choice"
  | "checkboxes"
  | "true_false"
  | "numeric_range"
  | "matching"
  | "ordering";

export interface QuizChoiceJson {
  id: string;
  shape?: "triangle" | "diamond" | "circle" | "square";
  text: string;
}

export type QuizSpecJson =
  | { choices: QuizChoiceJson[] }
  | { unit: string | null }
  | {
      prompts: Array<{ id: string; text: string }>;
      options: Array<{ id: string; text: string }>;
    }
  | { items: Array<{ id: string; text: string }> }
  | Record<string, never>;

export type QuizAnswerKeyJson =
  | { correctChoiceId: string }
  | { correctChoiceIds: string[] }
  | { correct: boolean }
  | { min: number; max: number }
  | { pairs: Record<string, string> }
  | { order: string[] };

export type QuizResponseJson = Record<string, unknown>;

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    role: userRoleEnum("role").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    usernameUnique: uniqueIndex("users_username_idx").on(table.username),
  }),
);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shareCode: text("share_code").notNull(),
    teacherId: uuid("teacher_id").references(() => users.id, {
      onDelete: "set null",
    }),
    bookId: uuid("book_id").references(() => books.id, {
      onDelete: "set null",
    }),
    unitKey: text("unit_key").notNull(),
    unitTitle: text("unit_title").notNull(),
    pageRangeLabel: text("page_range_label").notNull(),
    bookTitle: text("book_title").notNull(),
    language: text("language").notNull(),
    audience: text("audience").notNull(),
    amountOfLessons: integer("amount_of_lessons").notNull().default(1),
    minutesPerLesson: integer("minutes_per_lesson").notNull().default(45),
    creativeAngle: text("creative_angle").notNull().default(""),
    deliverables: jsonb("deliverables")
      .$type<LessonDeliverablesJson>()
      .notNull(),
    stage: lessonStageEnum("stage").notNull().default("generating_plan"),
    title: text("title").notNull(),
    planBlocks: jsonb("plan_blocks")
      .$type<LessonPlanBlockJson[]>()
      .notNull()
      .default([]),
    slides: jsonb("slides").$type<LessonSlideJson[]>().notNull().default([]),
    homework: jsonb("homework")
      .$type<HomeworkItemJson[]>()
      .notNull()
      .default([]),
    grounding: jsonb("grounding").$type<LessonGroundingJson | null>(),
    conceptId: text("concept_id"),
    isSample: boolean("is_sample").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shareCodeUnique: uniqueIndex("lessons_share_code_idx").on(table.shareCode),
  }),
);

export const lessonAssets = pgTable("lesson_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  kind: lessonAssetKindEnum("kind").notNull(),
  name: text("name").notNull(),
  url: text("url"),
  notesText: text("notes_text"),
  includeAsSlide: boolean("include_as_slide").notNull().default(false),
  useInAi: boolean("use_in_ai").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const lessonJobs = pgTable("lesson_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  kind: lessonJobKindEnum("kind").notNull(),
  status: lessonJobStatusEnum("status").notNull().default("queued"),
  error: text("error"),
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  placement: quizPlacementEnum("placement").notNull().default("live"),
  kind: quizItemKindEnum("kind").notNull().default("multiple_choice"),
  prompt: text("prompt").notNull(),
  scenarioNote: text("scenario_note"),
  requireExplanation: boolean("require_explanation").notNull().default(false),
  spec: jsonb("spec").$type<QuizSpecJson>().notNull().default({}),
  answerKey: jsonb("answer_key").$type<QuizAnswerKeyJson>().notNull().default({
    correctChoiceId: "",
  }),
  explanation: text("explanation").notNull().default(""),
  timeLimitSec: integer("time_limit_sec").notNull().default(20),
  points: integer("points").notNull().default(1000),
  conceptId: text("concept_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  placement: quizPlacementEnum("placement").notNull().default("live"),
  scorePoints: integer("score_points").notNull(),
  correctCount: integer("correct_count").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  masteryRatio: real("mastery_ratio").notNull(),
  bestStreak: integer("best_streak").notNull().default(0),
  durationSec: integer("duration_sec").notNull(),
  gradeFiveScale: integer("grade_five_scale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const quizAttemptItems = pgTable("quiz_attempt_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => quizQuestions.id, { onDelete: "cascade" }),
  response: jsonb("response").$type<QuizResponseJson>().notNull().default({}),
  isCorrect: boolean("is_correct").notNull(),
  timeSpentSec: integer("time_spent_sec").notNull().default(0),
});

export const learningEvents = pgTable("learning_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").references(() => lessons.id, {
    onDelete: "set null",
  }),
  bookId: uuid("book_id").references(() => books.id, {
    onDelete: "set null",
  }),
  conceptId: text("concept_id"),
  eventType: learningEventTypeEnum("event_type").notNull(),
  masteryRatio: real("mastery_ratio"),
  gradeFiveScale: integer("grade_five_scale"),
  timeSpentSec: integer("time_spent_sec"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Country = typeof countries.$inferSelect;
export type Book = typeof books.$inferSelect;
export type BookPage = typeof bookPages.$inferSelect;
export type IngestionJob = typeof ingestionJobs.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type LessonAsset = typeof lessonAssets.$inferSelect;
export type LessonJob = typeof lessonJobs.$inferSelect;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type QuizAttemptItem = typeof quizAttemptItems.$inferSelect;
export type LearningEvent = typeof learningEvents.$inferSelect;
