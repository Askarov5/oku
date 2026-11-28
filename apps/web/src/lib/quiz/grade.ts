import type {
  QuizConfig,
  QuizItem,
  QuizResponse,
  QuizResult,
  QuizResultItem,
  QuizReveal,
} from "./types";
import { defaultQuizConfig } from "./types";

export const mergeQuizConfig = (
  partial?: Partial<QuizConfig>,
): QuizConfig => ({
  ...defaultQuizConfig,
  ...partial,
});

/** Accept both `3.14` and `3,14` as decimals. */
export const parseNumericInput = (raw: string): number | null => {
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

const setsEqual = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  const set = new Set(left);
  return right.every((id) => set.has(id));
};

export const isResponseCorrect = (
  question: QuizItem,
  response: QuizResponse | undefined,
): boolean => {
  if (!response || response.kind !== question.kind) return false;
  if (!question.answer) return false;

  switch (question.kind) {
    case "multiple_choice": {
      if (response.kind !== "multiple_choice") return false;
      return (
        response.choiceId !== null &&
        response.choiceId === question.answer.correctChoiceId
      );
    }
    case "checkboxes": {
      if (response.kind !== "checkboxes") return false;
      return setsEqual(response.choiceIds, question.answer.correctChoiceIds);
    }
    case "true_false": {
      if (response.kind !== "true_false") return false;
      return (
        response.value !== null && response.value === question.answer.correct
      );
    }
    case "numeric_range": {
      if (response.kind !== "numeric_range") return false;
      const value = parseNumericInput(response.value);
      if (value === null) return false;
      return value >= question.answer.min && value <= question.answer.max;
    }
    case "matching": {
      if (response.kind !== "matching") return false;
      const expected = question.answer.pairs;
      const prompts = Object.keys(expected);
      if (prompts.length === 0) return false;
      return prompts.every(
        (promptId) => response.pairs[promptId] === expected[promptId],
      );
    }
    case "ordering": {
      if (response.kind !== "ordering") return false;
      if (response.order.length !== question.answer.order.length) return false;
      return question.answer.order.every(
        (id: string, index: number) => response.order[index] === id,
      );
    }
    default:
      return false;
  }
};

export const pointsForAnswer = (input: {
  question: QuizItem;
  isCorrect: boolean;
  elapsedSec: number;
  config: QuizConfig;
}): number => {
  if (!input.isCorrect) return 0;
  if (!input.config.speedBonus || !input.config.timed) {
    return input.question.points;
  }
  const limit = Math.max(1, input.question.timeLimitSec);
  const speedBonus = Math.max(0, 1 - input.elapsedSec / limit);
  return Math.round(input.question.points * (0.5 + 0.5 * speedBonus));
};

export const publicCorrectAnswer = (question: QuizItem): unknown => {
  if (!question.answer) return null;
  switch (question.kind) {
    case "multiple_choice":
      return { correctChoiceId: question.answer.correctChoiceId };
    case "checkboxes":
      return { correctChoiceIds: question.answer.correctChoiceIds };
    case "true_false":
      return { correct: question.answer.correct };
    case "numeric_range":
      return { min: question.answer.min, max: question.answer.max };
    case "matching":
      return { pairs: question.answer.pairs };
    case "ordering":
      return { order: question.answer.order };
    default:
      return null;
  }
};

export const buildReveal = (input: {
  question: QuizItem;
  response: QuizResponse;
  config: QuizConfig;
}): QuizReveal => {
  const isCorrect = isResponseCorrect(input.question, input.response);
  const pointsEarned = pointsForAnswer({
    question: input.question,
    isCorrect,
    elapsedSec: input.response.elapsedSec,
    config: input.config,
  });
  return {
    questionId: input.question.id,
    isCorrect,
    pointsEarned,
    explanation: input.config.showExplanation
      ? input.question.explanation || null
      : null,
    correctAnswer: publicCorrectAnswer(input.question),
  };
};

export const grade = (
  questions: QuizItem[],
  responses: QuizResponse[],
  configPartial?: Partial<QuizConfig>,
): QuizResult => {
  const config = mergeQuizConfig(configPartial);
  const byId = new Map(responses.map((row) => [row.questionId, row]));
  let scorePoints = 0;
  let correctCount = 0;
  let streak = 0;
  let bestStreak = 0;
  let durationSec = 0;

  const items: QuizResultItem[] = questions.map((question) => {
    const response = byId.get(question.id);
    const elapsed = Math.max(0, Math.round(response?.elapsedSec ?? 0));
    durationSec += elapsed;
    const isCorrect = isResponseCorrect(question, response);
    const pointsEarned = pointsForAnswer({
      question,
      isCorrect,
      elapsedSec: elapsed,
      config,
    });
    if (isCorrect) {
      correctCount += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      scorePoints += pointsEarned;
    } else {
      streak = 0;
    }
    const fallbackResponse: QuizResponse = response ?? {
      kind: question.kind,
      questionId: question.id,
      elapsedSec: elapsed,
      ...(question.kind === "multiple_choice"
        ? { choiceId: null }
        : question.kind === "checkboxes"
          ? { choiceIds: [] }
          : question.kind === "true_false"
            ? { value: null }
            : question.kind === "numeric_range"
              ? { value: "" }
              : question.kind === "matching"
                ? { pairs: {} }
                : { order: [] }),
    } as QuizResponse;

    return {
      questionId: question.id,
      response: fallbackResponse,
      isCorrect,
      pointsEarned,
      timeSpentSec: elapsed,
    };
  });

  const totalQuestions = questions.length || 1;
  return {
    items,
    scorePoints,
    correctCount,
    totalQuestions: questions.length,
    masteryRatio: correctCount / totalQuestions,
    bestStreak,
    durationSec,
  };
};

/** Strip answer keys for student payloads. */
export const toPublicQuestion = <T extends QuizItem>(question: T): T => {
  const { answer: _answer, ...rest } = question;
  return {
    ...rest,
    explanation: "",
  } as T;
};

export const toPublicQuestions = (questions: QuizItem[]): QuizItem[] =>
  questions.map(toPublicQuestion);
