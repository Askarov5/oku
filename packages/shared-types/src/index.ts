export * from "./block-ast.js";
export * from "./units.js";

export type BookLanguage = "ky" | "ru";
export type BookStatus = "draft" | "review" | "published";
export type BookPageStatus = "pending" | "extracted" | "reviewed" | "failed";
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
