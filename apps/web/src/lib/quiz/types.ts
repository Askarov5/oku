export type QuizChoiceShape = "triangle" | "diamond" | "circle" | "square";

export type QuizItemKind =
  | "multiple_choice"
  | "checkboxes"
  | "true_false"
  | "numeric_range"
  | "matching"
  | "ordering";

export interface QuizChoice {
  id: string;
  shape?: QuizChoiceShape;
  text: string;
}

export interface MatchingPrompt {
  id: string;
  text: string;
}

export interface MatchingOption {
  id: string;
  text: string;
}

export interface OrderingItem {
  id: string;
  text: string;
}

interface QuizItemBase {
  id: string;
  kind: QuizItemKind;
  prompt: string;
  scenarioNote: string | null;
  explanation: string;
  timeLimitSec: number;
  points: number;
  requireExplanation: boolean;
}

export interface MultipleChoiceItem extends QuizItemBase {
  kind: "multiple_choice";
  choices: QuizChoice[];
  answer?: { correctChoiceId: string };
}

export interface CheckboxesItem extends QuizItemBase {
  kind: "checkboxes";
  choices: QuizChoice[];
  answer?: { correctChoiceIds: string[] };
}

export interface TrueFalseItem extends QuizItemBase {
  kind: "true_false";
  answer?: { correct: boolean };
}

export interface NumericRangeItem extends QuizItemBase {
  kind: "numeric_range";
  unit: string | null;
  answer?: { min: number; max: number };
}

export interface MatchingItem extends QuizItemBase {
  kind: "matching";
  prompts: MatchingPrompt[];
  options: MatchingOption[];
  answer?: { pairs: Record<string, string> };
}

export interface OrderingItemQuestion extends QuizItemBase {
  kind: "ordering";
  items: OrderingItem[];
  answer?: { order: string[] };
}

export type QuizItem =
  | MultipleChoiceItem
  | CheckboxesItem
  | TrueFalseItem
  | NumericRangeItem
  | MatchingItem
  | OrderingItemQuestion;

export interface QuizConfig {
  timed: boolean;
  showResultLive: boolean;
  showExplanation: boolean;
  speedBonus: boolean;
  showSummary: boolean;
}

export const defaultQuizConfig: QuizConfig = {
  timed: false,
  showResultLive: true,
  showExplanation: true,
  speedBonus: false,
  showSummary: true,
};

export const DEFAULT_TIME_LIMITS: Record<QuizItemKind, number> = {
  multiple_choice: 20,
  true_false: 15,
  checkboxes: 30,
  numeric_range: 40,
  ordering: 40,
  matching: 45,
};

export const DEFAULT_POINTS = 1000;

export const CHOICE_SHAPES: QuizChoiceShape[] = [
  "triangle",
  "diamond",
  "circle",
  "square",
];

export interface MultipleChoiceResponse {
  kind: "multiple_choice";
  questionId: string;
  choiceId: string | null;
  elapsedSec: number;
  reasoning?: string;
}

export interface CheckboxesResponse {
  kind: "checkboxes";
  questionId: string;
  choiceIds: string[];
  elapsedSec: number;
  reasoning?: string;
}

export interface TrueFalseResponse {
  kind: "true_false";
  questionId: string;
  value: boolean | null;
  elapsedSec: number;
  reasoning?: string;
}

export interface NumericRangeResponse {
  kind: "numeric_range";
  questionId: string;
  value: string;
  elapsedSec: number;
  reasoning?: string;
}

export interface MatchingResponse {
  kind: "matching";
  questionId: string;
  pairs: Record<string, string>;
  elapsedSec: number;
  reasoning?: string;
}

export interface OrderingResponse {
  kind: "ordering";
  questionId: string;
  order: string[];
  elapsedSec: number;
  reasoning?: string;
}

export type QuizResponse =
  | MultipleChoiceResponse
  | CheckboxesResponse
  | TrueFalseResponse
  | NumericRangeResponse
  | MatchingResponse
  | OrderingResponse;

export interface QuizReveal {
  questionId: string;
  isCorrect: boolean;
  pointsEarned: number;
  explanation: string | null;
  /** Public-safe view of the correct answer for this item. */
  correctAnswer: unknown;
}

export interface QuizResultItem {
  questionId: string;
  response: QuizResponse;
  isCorrect: boolean;
  pointsEarned: number;
  timeSpentSec: number;
}

export interface QuizResult {
  items: QuizResultItem[];
  scorePoints: number;
  correctCount: number;
  totalQuestions: number;
  masteryRatio: number;
  bestStreak: number;
  durationSec: number;
}

/** Spec stored in DB (safe for student when answer_key is stripped). */
export type QuizSpecJson =
  | { choices: QuizChoice[] }
  | Record<string, never>
  | { unit: string | null }
  | { prompts: MatchingPrompt[]; options: MatchingOption[] }
  | { items: OrderingItem[] };

export type QuizAnswerKeyJson =
  | { correctChoiceId: string }
  | { correctChoiceIds: string[] }
  | { correct: boolean }
  | { min: number; max: number }
  | { pairs: Record<string, string> }
  | { order: string[] };
