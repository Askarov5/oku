import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
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
]);
export const ingestionJobStatusEnum = pgEnum("ingestion_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

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
  grade: integer("grade").notNull(),
  subject: text("subject").notNull(),
  language: bookLanguageEnum("language").notNull(),
  title: text("title").notNull(),
  authorName: text("author_name"),
  /** The uploaded PDF, stored unchanged. */
  sourcePdfUrl: text("source_pdf_url").notNull(),
  /** First page of the PDF as an image, made at upload. Null for books uploaded without one. */
  coverImageUrl: text("cover_image_url"),
  isCanonical: boolean("is_canonical").notNull().default(true),
  status: bookStatusEnum("status").notNull().default("draft"),
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
  totalPages: integer("total_pages").notNull(),
  completedPages: integer("completed_pages").notNull().default(0),
  failedPages: integer("failed_pages").notNull().default(0),
  error: text("error"),
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
  /** Page range by position in the source PDF. */
  pageStart: number;
  pageEnd: number;
  /** The same range as printed on the pages; null where a page carries no number. */
  pageStartLabel: string | null;
  pageEndLabel: string | null;
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
 * The model that reads pages, as a LiteLLM id ("gemini/gemini-3.6-flash").
 * The AI worker looks it up when it starts an extraction job.
 */
export const EXTRACTION_MODEL_SETTING = "extraction_model";

export type Country = typeof countries.$inferSelect;
export type Book = typeof books.$inferSelect;
export type BookPage = typeof bookPages.$inferSelect;
export type IngestionJob = typeof ingestionJobs.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
