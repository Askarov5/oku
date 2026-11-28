import type {
  CheckboxesItem,
  MatchingItem,
  MultipleChoiceItem,
  NumericRangeItem,
  OrderingItemQuestion,
  QuizAnswerKeyJson,
  QuizChoice,
  QuizItem,
  QuizItemKind,
  QuizSpecJson,
  TrueFalseItem,
} from "./types";
import { CHOICE_SHAPES, DEFAULT_POINTS, DEFAULT_TIME_LIMITS } from "./types";

export interface QuizQuestionRow {
  id: string;
  kind: QuizItemKind;
  prompt: string;
  scenarioNote: string | null;
  explanation: string;
  timeLimitSec: number;
  points: number;
  requireExplanation: boolean;
  spec: QuizSpecJson;
  answerKey: QuizAnswerKeyJson;
}

export const stampChoiceShapes = (choices: QuizChoice[]): QuizChoice[] =>
  choices.map((choice, index) => ({
    ...choice,
    shape: CHOICE_SHAPES[index] ?? "square",
  }));

export const splitItemForStorage = (
  item: QuizItem,
): {
  kind: QuizItemKind;
  prompt: string;
  scenarioNote: string | null;
  explanation: string;
  timeLimitSec: number;
  points: number;
  requireExplanation: boolean;
  spec: QuizSpecJson;
  answerKey: QuizAnswerKeyJson;
} => {
  const base = {
    kind: item.kind,
    prompt: item.prompt,
    scenarioNote: item.scenarioNote,
    explanation: item.explanation,
    timeLimitSec: item.timeLimitSec,
    points: item.points,
    requireExplanation: item.requireExplanation,
  };

  switch (item.kind) {
    case "multiple_choice": {
      const choices = stampChoiceShapes(item.choices).map(
        ({ id, shape, text }) => ({ id, shape, text }),
      );
      return {
        ...base,
        spec: { choices },
        answerKey: {
          correctChoiceId:
            item.answer?.correctChoiceId ?? choices[0]?.id ?? "",
        },
      };
    }
    case "checkboxes": {
      return {
        ...base,
        spec: {
          choices: item.choices.map(({ id, text }) => ({ id, text })),
        },
        answerKey: {
          correctChoiceIds: item.answer?.correctChoiceIds ?? [],
        },
      };
    }
    case "true_false":
      return {
        ...base,
        spec: {},
        answerKey: { correct: item.answer?.correct ?? true },
      };
    case "numeric_range":
      return {
        ...base,
        spec: { unit: item.unit },
        answerKey: {
          min: item.answer?.min ?? 0,
          max: item.answer?.max ?? 0,
        },
      };
    case "matching":
      return {
        ...base,
        spec: {
          prompts: item.prompts,
          options: item.options,
        },
        answerKey: { pairs: item.answer?.pairs ?? {} },
      };
    case "ordering":
      return {
        ...base,
        spec: { items: item.items },
        answerKey: { order: item.answer?.order ?? [] },
      };
  }
};

export const rowToQuizItem = (
  row: QuizQuestionRow,
  options?: { hideAnswers?: boolean },
): QuizItem => {
  const base = {
    id: row.id,
    prompt: row.prompt,
    scenarioNote: row.scenarioNote,
    explanation: options?.hideAnswers ? "" : row.explanation,
    timeLimitSec: row.timeLimitSec || DEFAULT_TIME_LIMITS[row.kind],
    points: row.points || DEFAULT_POINTS,
    requireExplanation: row.requireExplanation,
  };

  const withAnswer = <T extends object>(answer: T): T | undefined =>
    options?.hideAnswers ? undefined : answer;

  switch (row.kind) {
    case "multiple_choice": {
      const spec = (row.spec ?? {}) as { choices?: QuizChoice[] };
      const key = (row.answerKey ?? {}) as { correctChoiceId?: string };
      const item: MultipleChoiceItem = {
        ...base,
        kind: "multiple_choice",
        choices: stampChoiceShapes(spec.choices ?? []),
        answer: withAnswer({ correctChoiceId: key.correctChoiceId ?? "" }),
      };
      return item;
    }
    case "checkboxes": {
      const spec = (row.spec ?? {}) as { choices?: QuizChoice[] };
      const key = (row.answerKey ?? {}) as { correctChoiceIds?: string[] };
      const item: CheckboxesItem = {
        ...base,
        kind: "checkboxes",
        choices: spec.choices ?? [],
        answer: withAnswer({ correctChoiceIds: key.correctChoiceIds ?? [] }),
      };
      return item;
    }
    case "true_false": {
      const key = (row.answerKey ?? {}) as { correct?: boolean };
      const item: TrueFalseItem = {
        ...base,
        kind: "true_false",
        answer: withAnswer({ correct: Boolean(key.correct) }),
      };
      return item;
    }
    case "numeric_range": {
      const spec = (row.spec ?? {}) as { unit?: string | null };
      const key = (row.answerKey ?? {}) as { min?: number; max?: number };
      const item: NumericRangeItem = {
        ...base,
        kind: "numeric_range",
        unit: spec.unit ?? null,
        answer: withAnswer({
          min: Number(key.min ?? 0),
          max: Number(key.max ?? key.min ?? 0),
        }),
      };
      return item;
    }
    case "matching": {
      const spec = (row.spec ?? {}) as {
        prompts?: MatchingItem["prompts"];
        options?: MatchingItem["options"];
      };
      const key = (row.answerKey ?? {}) as { pairs?: Record<string, string> };
      const item: MatchingItem = {
        ...base,
        kind: "matching",
        prompts: spec.prompts ?? [],
        options: spec.options ?? [],
        answer: withAnswer({ pairs: key.pairs ?? {} }),
      };
      return item;
    }
    case "ordering": {
      const spec = (row.spec ?? {}) as { items?: OrderingItemQuestion["items"] };
      const key = (row.answerKey ?? {}) as { order?: string[] };
      const item: OrderingItemQuestion = {
        ...base,
        kind: "ordering",
        items: spec.items ?? [],
        answer: withAnswer({ order: key.order ?? [] }),
      };
      return item;
    }
    default: {
      const fallback: MultipleChoiceItem = {
        ...base,
        kind: "multiple_choice",
        choices: [],
        answer: withAnswer({ correctChoiceId: "" }),
      };
      return fallback;
    }
  }
};

/** Backfill helper for legacy Kahoot rows still carrying choices + correct_choice_id. */
export const legacyKahootToItem = (input: {
  id: string;
  prompt: string;
  scenarioNote: string | null;
  explanation: string;
  timeLimitSec: number;
  points: number;
  choices: Array<{ id: string; shape?: string; text: string }>;
  correctChoiceId: string;
}): QuizItem => ({
  id: input.id,
  kind: "multiple_choice",
  prompt: input.prompt,
  scenarioNote: input.scenarioNote,
  explanation: input.explanation,
  timeLimitSec: input.timeLimitSec,
  points: input.points,
  requireExplanation: false,
  choices: stampChoiceShapes(
    input.choices.map((choice) => ({
      id: choice.id,
      text: choice.text,
    })),
  ),
  answer: { correctChoiceId: input.correctChoiceId },
});
