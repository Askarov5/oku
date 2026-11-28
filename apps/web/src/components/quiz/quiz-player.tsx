"use client";

import { Button } from "@oku/ui";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  buildReveal,
  mergeQuizConfig,
  type QuizConfig,
  type QuizItem,
  type QuizResponse,
  type QuizResult,
  type QuizReveal,
} from "@/lib/quiz";
import {
  AnswerControl,
  locksOnTap,
  responseIsReady,
} from "./answer-controls";

type Phase = "question" | "reveal" | "done";

interface QuizPlayerProps {
  questions: QuizItem[];
  config?: Partial<QuizConfig>;
  onSubmitItem?: (response: QuizResponse) => Promise<QuizReveal | null>;
  onComplete: (result: QuizResult) => void;
  headerExtra?: ReactElement | null;
}

const shuffle = <T,>(items: T[]): T[] => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
  }
  return next;
};

const emptyDraft = (question: QuizItem): QuizResponse => {
  switch (question.kind) {
    case "multiple_choice":
      return {
        kind: "multiple_choice",
        questionId: question.id,
        choiceId: null,
        elapsedSec: 0,
      };
    case "checkboxes":
      return {
        kind: "checkboxes",
        questionId: question.id,
        choiceIds: [],
        elapsedSec: 0,
      };
    case "true_false":
      return {
        kind: "true_false",
        questionId: question.id,
        value: null,
        elapsedSec: 0,
      };
    case "numeric_range":
      return {
        kind: "numeric_range",
        questionId: question.id,
        value: "",
        elapsedSec: 0,
      };
    case "matching":
      return {
        kind: "matching",
        questionId: question.id,
        pairs: {},
        elapsedSec: 0,
      };
    case "ordering":
      return {
        kind: "ordering",
        questionId: question.id,
        order: shuffle(question.items.map((item) => item.id)),
        elapsedSec: 0,
      };
  }
};

export const QuizPlayer = ({
  questions,
  config: configPartial,
  onSubmitItem,
  onComplete,
  headerExtra,
}: QuizPlayerProps): ReactElement => {
  const config = mergeQuizConfig(configPartial);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [draft, setDraft] = useState<QuizResponse | null>(null);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [reveal, setReveal] = useState<QuizReveal | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);

  const question = questions[index] ?? null;

  const promptOrder = useMemo(() => {
    if (!question || question.kind !== "matching") return [];
    return shuffle(question.prompts.map((p) => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  const optionOrder = useMemo(() => {
    if (!question || question.kind !== "matching") return [];
    return shuffle(question.options.map((o) => o.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  useEffect(() => {
    if (!question) return;
    setDraft(emptyDraft(question));
    setReveal(null);
    setPhase("question");
    setSecondsLeft(question.timeLimitSec);
    setStartedAt(Date.now());
  }, [question?.id]);

  useEffect(() => {
    if (!config.timed || phase !== "question" || !question) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          void lockCurrent(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, question?.id, config.timed]);

  const elapsed = (): number =>
    Math.max(0, Math.round((Date.now() - startedAt) / 1000));

  const lockCurrent = async (timedOut = false): Promise<void> => {
    if (!question || phase !== "question" || submitting) return;
    const current = draft ?? emptyDraft(question);
    const withTime: QuizResponse = {
      ...current,
      elapsedSec: timedOut ? question.timeLimitSec : elapsed(),
      reasoning: timedOut && !current.reasoning?.trim() ? "" : current.reasoning,
    };

    setSubmitting(true);
    try {
      let nextReveal: QuizReveal | null = null;
      if (question.answer) {
        nextReveal = buildReveal({ question, response: withTime, config });
      } else if (onSubmitItem) {
        nextReveal = await onSubmitItem(withTime);
      }

      const nextResponses = [
        ...responses.filter((row) => row.questionId !== question.id),
        withTime,
      ];
      setResponses(nextResponses);
      setDraft(withTime);

      if (config.showResultLive && nextReveal) {
        setReveal(nextReveal);
        setPhase("reveal");
      } else {
        advance(nextResponses);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const advance = (finalResponses: QuizResponse[]): void => {
    const nextIndex = index + 1;
    if (nextIndex < questions.length) {
      setIndex(nextIndex);
      return;
    }
    // Local result summary for hosts that grade client-side; hosts with keys
    // stripped still receive responses and re-grade on the server in onComplete.
    const items = questions.map((q) => {
      const response =
        finalResponses.find((row) => row.questionId === q.id) ?? emptyDraft(q);
      const localReveal = q.answer
        ? buildReveal({ question: q, response, config })
        : null;
      return {
        questionId: q.id,
        response,
        isCorrect: localReveal?.isCorrect ?? false,
        pointsEarned: localReveal?.pointsEarned ?? 0,
        timeSpentSec: response.elapsedSec,
      };
    });
    const correctCount = items.filter((item) => item.isCorrect).length;
    let bestStreak = 0;
    let streak = 0;
    for (const item of items) {
      if (item.isCorrect) {
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
      } else {
        streak = 0;
      }
    }
    const result: QuizResult = {
      items,
      scorePoints: items.reduce((sum, item) => sum + item.pointsEarned, 0),
      correctCount,
      totalQuestions: questions.length,
      masteryRatio: correctCount / (questions.length || 1),
      bestStreak,
      durationSec: items.reduce((sum, item) => sum + item.timeSpentSec, 0),
    };
    setPhase("done");
    onComplete(result);
  };

  if (!question) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">No questions.</p>
    );
  }

  const ready = responseIsReady(question, draft);
  const tapLock = locksOnTap(question);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
          {index + 1} / {questions.length}
        </p>
        {headerExtra}
        {config.timed ? (
          <p className="font-[family-name:var(--font-mono)] text-sm tabular-nums">
            {secondsLeft}s
          </p>
        ) : null}
      </div>

      {config.timed ? (
        <div
          className="h-2 overflow-hidden rounded-[var(--rounded-xs)] bg-[var(--bg-canvas)]"
          aria-hidden
        >
          <div
            className="h-full bg-[var(--accent-primary)] transition-[width] duration-1000 linear"
            style={{
              width: `${Math.max(0, (secondsLeft / Math.max(1, question.timeLimitSec)) * 100)}%`,
            }}
          />
        </div>
      ) : null}

      <div>
        <h2 className="text-xl font-bold tracking-[-0.02em] sm:text-2xl">
          {question.prompt}
        </h2>
        {question.scenarioNote ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {question.scenarioNote}
          </p>
        ) : null}
      </div>

      {phase === "question" ? (
        <>
          <AnswerControl
            question={question}
            locked={false}
            draft={draft}
            promptOrder={promptOrder}
            optionOrder={optionOrder}
            onChange={setDraft}
            onLock={
              tapLock
                ? () => {
                    void lockCurrent(false);
                  }
                : undefined
            }
          />

          {question.requireExplanation ? (
            <label className="block space-y-1">
              <span className="text-sm font-medium">How did you get this?</span>
              <textarea
                required
                rows={3}
                value={draft?.reasoning ?? ""}
                className="w-full rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                onChange={(event) =>
                  setDraft((prev) =>
                    prev
                      ? { ...prev, reasoning: event.target.value }
                      : {
                          ...emptyDraft(question),
                          reasoning: event.target.value,
                        },
                  )
                }
              />
            </label>
          ) : null}

          {!tapLock ? (
            <Button
              disabled={!ready || submitting}
              onClick={() => void lockCurrent(false)}
            >
              {submitting ? "Checking…" : "Submit answer"}
            </Button>
          ) : null}
        </>
      ) : null}

      {phase === "reveal" && reveal ? (
        <section
          aria-live="polite"
          className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] border-l-4 border-l-[var(--accent-primary)] bg-[var(--bg-surface)] p-4"
        >
          <p className="text-lg font-semibold">
            {reveal.isCorrect ? "Correct" : "Not quite"}
          </p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-sm tabular-nums">
            +{reveal.pointsEarned} pts
          </p>
          {config.showExplanation && reveal.explanation ? (
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {reveal.explanation}
            </p>
          ) : null}
          <Button
            className="mt-4"
            onClick={() => advance(responses)}
          >
            {index + 1 < questions.length ? "Next" : "Finish"}
          </Button>
        </section>
      ) : null}
    </div>
  );
};
