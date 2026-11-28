import type { QuizItemKind } from "@/lib/quiz";

export interface QuizKindOption {
  kind: QuizItemKind;
  label: string;
  detail: string;
}

export const QUIZ_KIND_OPTIONS: readonly QuizKindOption[] = [
  {
    kind: "multiple_choice",
    label: "Multiple choice",
    detail: "One correct answer",
  },
  {
    kind: "checkboxes",
    label: "Checkboxes",
    detail: "More than one correct answer",
  },
  {
    kind: "true_false",
    label: "True / false",
    detail: "A single true or false statement",
  },
  {
    kind: "numeric_range",
    label: "Numeric range",
    detail: "A number between a minimum and maximum",
  },
  {
    kind: "matching",
    label: "Matching",
    detail: "Pair each prompt with an option",
  },
  {
    kind: "ordering",
    label: "Ordering",
    detail: "Arrange items in the correct sequence",
  },
];

export const QUIZ_KIND_LABELS: Record<QuizItemKind, string> = {
  multiple_choice: "Multiple choice",
  checkboxes: "Checkboxes",
  true_false: "True / false",
  numeric_range: "Numeric range",
  matching: "Matching",
  ordering: "Ordering",
};
