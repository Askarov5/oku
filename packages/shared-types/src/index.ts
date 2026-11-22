export * from "./block-ast.js";
export * from "./table-lift.js";
export * from "./units.js";

export type BookLanguage = "ky" | "ru";
export type BookStatus = "draft" | "review" | "published";
export type BookPageStatus =
  | "pending"
  | "extracted"
  | "reviewed"
  | "failed"
  /** Kept on the book from the original PDF; not sent to AI yet. */
  | "stored";
export type IngestionJobStatus = "queued" | "running" | "completed" | "failed";

export interface CountryConfig {
  languages: BookLanguage[];
  gradeRange: [number, number];
  calendar: "4_quarters" | "2_semesters";
  gradingScale: {
    type: "5_point" | "10_point" | "100_point";
    thresholds?: number[];
  };
  nationalExam: string;
}
