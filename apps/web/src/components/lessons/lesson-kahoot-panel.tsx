"use client";

import { Button, buttonClasses } from "@oku/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { useState } from "react";
import { GradePill } from "@/components/lessons/grade-pill";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  TrophyIcon,
} from "@/components/lessons/lesson-icons";
import { QrMatrix } from "@/components/lessons/qr-matrix";
import { AddQuizQuestionButton } from "@/components/quiz/add-quiz-question-button";
import {
  createBlankQuizItem,
  QuizItemEditor,
} from "@/components/quiz/quiz-item-editor";
import type { QuizLeaderboardEntry } from "@/lib/lesson-studio";
import type { QuizItem, QuizItemKind } from "@/lib/quiz";

interface LessonKahootPanelProps {
  shareCode: string;
  questions: QuizItem[];
  leaderboard: QuizLeaderboardEntry[];
  readOnly?: boolean;
  dirty?: boolean;
  saving?: boolean;
  justSaved?: boolean;
  onChangeQuestions: (questions: QuizItem[]) => void;
  onSave?: () => void;
}

export const LessonKahootPanel = ({
  shareCode,
  questions,
  leaderboard,
  readOnly = false,
  dirty = false,
  saving = false,
  justSaved = false,
  onChangeQuestions,
  onSave,
}: LessonKahootPanelProps): ReactElement => {
  const [view, setView] = useState<"questions" | "leaderboard">("questions");
  const [copied, setCopied] = useState(false);
  const addQuestion = (kind: QuizItemKind): void => {
    const item = createBlankQuizItem(kind);
    onChangeQuestions([...questions, item]);
    window.requestAnimationFrame(() => {
      document.getElementById(`quiz-item-${item.id}`)?.scrollIntoView({
        block: "nearest",
      });
    });
  };
  const canSave = Boolean(onSave) && !readOnly && dirty && !saving;
  const saveLabel = saving
    ? "Saving…"
    : justSaved && !dirty
      ? "Saved"
      : "Save quiz";

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

  return (
    <div className="grid gap-6">
      <div className="grid items-center gap-5 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h3 className="text-lg font-semibold">
            Shareable student quiz
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Students open the link or scan the QR, sign in as a student, and get
            auto-graded on the 2–5 scale.
          </p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <code className="max-w-full break-all rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm font-medium">
              {sharePath}
            </code>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => void copyShareLink()}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied link" : "Copy student link"}
            </Button>
            <Link
              href={sharePath}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClasses({ variant: "primary" })} w-full justify-center sm:w-auto`}
            >
              <ExternalLinkIcon />
              Play as student
              <span className="sr-only">, opens in a new tab</span>
            </Link>
          </div>
        </div>
        <QrMatrix value={sharePath} sizeClass="size-28" />
      </div>

      <div className="flex flex-col gap-3 border-b border-[var(--border-hairline)] pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div role="group" aria-label="Quiz studio view" className="flex gap-2">
          <button
            type="button"
            aria-pressed={view === "questions"}
            onClick={() => setView("questions")}
            className={`min-h-11 flex-1 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors sm:flex-none ${
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
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors sm:flex-none ${
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
          <div className="flex flex-wrap items-center gap-2">
            {onSave ? (
              <Button
                variant={dirty ? "primary" : "secondary"}
                size="sm"
                disabled={!canSave}
                onClick={onSave}
              >
                {saveLabel}
              </Button>
            ) : null}
            <AddQuizQuestionButton disabled={readOnly} onAdd={addQuestion} />
          </div>
        ) : null}
      </div>

      {view === "questions" ? (
        <div className="space-y-4">
          <p className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm leading-5 text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">
              Set the correct answer on each question.{" "}
            </span>
            Select the radio button or checkboxes beside the right options,
            choose True or False, enter the accepted number range, pick each
            match from its dropdown, or write ordering steps in the numbered
            sequence. Save the quiz when you are done.
          </p>
          {questions.map((question) => (
            <QuizItemEditor
              key={question.id}
              item={question}
              canRemove={questions.length > 1}
              onChange={(next) =>
                onChangeQuestions(
                  questions.map((row) => (row.id === next.id ? next : row)),
                )
              }
              onRemove={() =>
                onChangeQuestions(
                  questions.filter((row) => row.id !== question.id),
                )
              }
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          {leaderboard.length === 0 ? (
            <p className="p-5 text-sm text-[var(--text-secondary)]">
              No student attempts yet. Share the quiz link to start collecting
              results.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Grade</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, index) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border-hairline)] last:border-0"
                  >
                    <td className="px-4 py-3 font-[family-name:var(--font-mono)] tabular-nums text-[var(--text-secondary)]">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.studentName}</td>
                    <td className="px-4 py-3 font-[family-name:var(--font-mono)] tabular-nums">
                      {row.scorePoints} · {row.correctCount}/{row.totalQuestions}
                    </td>
                    <td className="px-4 py-3">
                      <GradePill grade={row.gradeFiveScale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
