"use client";

import { Button, TrashIcon, buttonClasses, fieldClass } from "@oku/ui";
import Link from "next/link";
import type { CSSProperties, ReactElement } from "react";
import { useState } from "react";
import { GradePill } from "@/components/lessons/grade-pill";
import {
  CheckIcon,
  ChoiceShapeMark,
  CopyIcon,
  ExternalLinkIcon,
  PlusIcon,
  TrophyIcon,
} from "@/components/lessons/lesson-icons";
import { QrMatrix } from "@/components/lessons/qr-matrix";
import type {
  KahootChoiceShape,
  KahootQuestion,
  QuizLeaderboardEntry,
} from "@/lib/lesson-studio";
import { CHOICE_SHAPES } from "@/lib/lesson-studio";

interface LessonKahootPanelProps {
  shareCode: string;
  questions: KahootQuestion[];
  leaderboard: QuizLeaderboardEntry[];
  onChangeQuestions: (questions: KahootQuestion[]) => void;
}

const CHOICE_STYLE: Record<KahootChoiceShape, CSSProperties> = {
  triangle: { backgroundColor: "var(--choice-a)", color: "var(--on-choice)" },
  diamond: { backgroundColor: "var(--choice-b)", color: "var(--on-choice)" },
  circle: { backgroundColor: "var(--choice-c)", color: "var(--on-choice)" },
  square: { backgroundColor: "var(--choice-d)", color: "var(--on-choice)" },
};

export const LessonKahootPanel = ({
  shareCode,
  questions,
  leaderboard,
  onChangeQuestions,
}: LessonKahootPanelProps): ReactElement => {
  const [view, setView] = useState<"questions" | "leaderboard">("questions");
  const [copied, setCopied] = useState(false);

  const sharePath = `/play/${shareCode}`;

  const copyShareLink = async (): Promise<void> => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${sharePath}`
        : sharePath;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const updateQuestion = (
    questionId: string,
    patch: Partial<KahootQuestion>,
  ): void => {
    onChangeQuestions(
      questions.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question,
      ),
    );
  };

  const setCorrectChoice = (questionId: string, choiceId: string): void => {
    onChangeQuestions(
      questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              choices: question.choices.map((choice) => ({
                ...choice,
                isCorrect: choice.id === choiceId,
              })),
            }
          : question,
      ),
    );
  };

  const updateChoiceText = (
    questionId: string,
    choiceId: string,
    text: string,
  ): void => {
    onChangeQuestions(
      questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              choices: question.choices.map((choice) =>
                choice.id === choiceId ? { ...choice, text } : choice,
              ),
            }
          : question,
      ),
    );
  };

  const addQuestion = (): void => {
    const nextNum = questions.length + 1;
    const created: KahootQuestion = {
      id: `q-custom-${Date.now()}`,
      prompt: `Question ${nextNum}: Enter your classroom check question`,
      scenarioNote: null,
      timeLimitSec: 20,
      points: 1000,
      choices: CHOICE_SHAPES.map((shape, index) => ({
        id: `qc-${Date.now()}-${index}`,
        shape,
        text: `Option ${index + 1}`,
        isCorrect: index === 0,
      })),
      explanation: "Explain why the right answer holds.",
    };
    onChangeQuestions([...questions, created]);
  };

  const removeQuestion = (questionId: string): void => {
    if (questions.length <= 1) return;
    onChangeQuestions(questions.filter((item) => item.id !== questionId));
  };

  return (
    <div className="grid gap-6">
      {/* Shareable Game Link & QR Strip */}
      <div className="grid items-center gap-5 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h3 className="text-lg font-semibold">
            Shareable Kahoot-style student quiz
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Students open the link or scan the QR code on their phone, enter
            their name (no login required), and get auto-graded on the 2–5
            scale.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <code className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm font-medium">
              {sharePath}
            </code>
            <Button variant="secondary" size="sm" onClick={() => void copyShareLink()}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied link" : "Copy student link"}
            </Button>
            <Link
              href={sharePath}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: "primary", size: "sm" })}
            >
              <ExternalLinkIcon />
              Play as student
              <span className="sr-only">, opens in a new tab</span>
            </Link>
          </div>
        </div>

        <QrMatrix value={sharePath} sizeClass="size-28" />
      </div>

      {/* Sub-navigation: Questions vs. Live Student Leaderboard */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
        <div role="group" aria-label="Quiz studio view" className="flex gap-2">
          <button
            type="button"
            aria-pressed={view === "questions"}
            onClick={() => setView("questions")}
            className={`rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors coarse:min-h-[44px] ${
              view === "questions"
                ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            Questions ({questions.length})
          </button>
          <button
            type="button"
            aria-pressed={view === "leaderboard"}
            onClick={() => setView("leaderboard")}
            className={`inline-flex items-center gap-2 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors coarse:min-h-[44px] ${
              view === "leaderboard"
                ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <TrophyIcon />
            Leaderboard ({leaderboard.length})
          </button>
        </div>

        {view === "questions" ? (
          <Button variant="ghost" size="sm" onClick={addQuestion}>
            <PlusIcon />
            Add question
          </Button>
        ) : null}
      </div>

      {view === "questions" ? (
        <ol className="divide-y divide-[var(--border-hairline)] rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          {questions.map((question, qIndex) => (
            <li key={question.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`q-prompt-${question.id}`}
                    className="font-[family-name:var(--font-mono)] text-xs font-semibold tabular-nums text-[var(--text-secondary)]"
                  >
                    Question {qIndex + 1}
                  </label>
                  <input
                    id={`q-prompt-${question.id}`}
                    type="text"
                    value={question.prompt}
                    onChange={(event) =>
                      updateQuestion(question.id, { prompt: event.target.value })
                    }
                    className={`${fieldClass} mt-1.5 font-semibold`}
                  />
                </div>

                <div className="flex items-end gap-2">
                  <div>
                    <label
                      htmlFor={`q-time-${question.id}`}
                      className="block font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]"
                    >
                      Timer
                    </label>
                    <select
                      id={`q-time-${question.id}`}
                      value={question.timeLimitSec}
                      onChange={(event) =>
                        updateQuestion(question.id, {
                          timeLimitSec: Number(event.target.value),
                        })
                      }
                      className="mt-1.5 rounded-[var(--rounded-xs)] border border-[var(--border-control)] bg-[var(--bg-canvas)] px-2.5 py-2 font-[family-name:var(--font-mono)] text-xs tabular-nums coarse:min-h-[44px]"
                    >
                      <option value={15}>15s</option>
                      <option value={20}>20s</option>
                      <option value={25}>25s</option>
                      <option value={30}>30s</option>
                      <option value={45}>45s</option>
                    </select>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete question ${qIndex + 1}`}
                    disabled={questions.length <= 1}
                    onClick={() => removeQuestion(question.id)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </div>

              {/* 4 Kahoot-style answer tiles with geometric badges */}
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {question.choices.map((choice) => (
                  <div
                    key={choice.id}
                    className={`flex items-center gap-2.5 rounded-[var(--rounded-xs)] border p-2.5 ${
                      choice.isCorrect
                        ? "border-[var(--accent-primary)] bg-[var(--bg-hover)]"
                        : "border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                    }`}
                  >
                    <span
                      style={CHOICE_STYLE[choice.shape]}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--rounded-xs)]"
                    >
                      <ChoiceShapeMark shape={choice.shape} />
                    </span>
                    <input
                      type="text"
                      aria-label={`Answer choice ${choice.shape}`}
                      value={choice.text}
                      onChange={(event) =>
                        updateChoiceText(
                          question.id,
                          choice.id,
                          event.target.value,
                        )
                      }
                      className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm font-medium focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-pressed={choice.isCorrect}
                      onClick={() => setCorrectChoice(question.id, choice.id)}
                      className={`shrink-0 rounded-[var(--rounded-xs)] border px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs font-medium coarse:min-h-[44px] ${
                        choice.isCorrect
                          ? "border-transparent bg-[var(--accent-primary)] text-[var(--on-accent)]"
                          : "border-[var(--border-control)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {choice.isCorrect ? "Correct" : "Mark right"}
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <label
                  htmlFor={`q-exp-${question.id}`}
                  className="text-xs font-medium text-[var(--text-secondary)]"
                >
                  Post-answer explanation shown to students
                </label>
                <input
                  id={`q-exp-${question.id}`}
                  type="text"
                  value={question.explanation}
                  onChange={(event) =>
                    updateQuestion(question.id, {
                      explanation: event.target.value,
                    })
                  }
                  className={`${fieldClass} mt-1`}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="overflow-x-auto rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Correct</th>
                <th className="px-4 py-3 font-medium">Best streak</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">5-Point Grade</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]">
              {leaderboard.map((entry, idx) => (
                <tr key={entry.id} className="hover:bg-[var(--bg-hover)]">
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    <span className="inline-flex items-center gap-2">
                      <span>{entry.studentName}</span>
                      {entry.isSample ? (
                        <span className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs font-normal text-[var(--text-secondary)]">
                          Sample
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] font-semibold tabular-nums">
                    {entry.scorePoints}
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] tabular-nums">
                    {entry.correctCount}/{entry.totalQuestions}
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] tabular-nums text-[var(--text-secondary)]">
                    {entry.bestStreak}x
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] tabular-nums text-[var(--text-secondary)]">
                    {entry.durationSec}s
                  </td>
                  <td className="px-4 py-3">
                    <GradePill grade={entry.gradeFiveScale} />
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                    {entry.submittedAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
