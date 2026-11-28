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
  PlusIcon,
} from "@/components/lessons/lesson-icons";
import { QrMatrix } from "@/components/lessons/qr-matrix";
import {
  createBlankQuizItem,
  QuizItemEditor,
} from "@/components/quiz/quiz-item-editor";
import type { QuizLeaderboardEntry } from "@/lib/lesson-studio";
import type { QuizItem } from "@/lib/quiz";

interface LessonHomeworkPanelProps {
  shareCode: string;
  lessonTitle: string;
  homework: QuizItem[];
  attempts?: QuizLeaderboardEntry[];
  readOnly?: boolean;
  dirty?: boolean;
  saving?: boolean;
  justSaved?: boolean;
  onChangeHomework: (items: QuizItem[]) => void;
  onSave?: () => void;
}

export const LessonHomeworkPanel = ({
  shareCode,
  lessonTitle,
  homework,
  attempts = [],
  readOnly = false,
  dirty = false,
  saving = false,
  justSaved = false,
  onChangeHomework,
  onSave,
}: LessonHomeworkPanelProps): ReactElement => {
  const [copied, setCopied] = useState(false);
  const sharePath = `/play/${shareCode}/homework`;
  const canSave = Boolean(onSave) && !readOnly && dirty && !saving;
  const saveLabel = saving
    ? "Saving…"
    : justSaved && !dirty
      ? "Saved"
      : "Save homework";

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
    <div className="grid gap-5">
      <div className="grid items-center gap-5 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h3 className="text-lg font-semibold">Auto-graded homework</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Untimed practice with explanations required. Students open the link
            and submit work notes with each answer.
          </p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
            {lessonTitle} · {homework.length}{" "}
            {homework.length === 1 ? "question" : "questions"}
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
              {copied ? "Copied link" : "Copy homework link"}
            </Button>
            <Link
              href={sharePath}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClasses({ variant: "primary" })} w-full justify-center sm:w-auto`}
            >
              <ExternalLinkIcon />
              Open as student
            </Link>
          </div>
        </div>
        <QrMatrix value={sharePath} sizeClass="size-28" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-base font-semibold">Questions</h4>
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
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={() =>
              onChangeHomework([
                ...homework,
                {
                  ...createBlankQuizItem("multiple_choice"),
                  requireExplanation: true,
                },
              ])
            }
          >
            <PlusIcon />
            Add question
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <p className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm leading-5 text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">
            Set the correct answer on each question.{" "}
          </span>
          Select the radio button or checkboxes beside the right options,
          choose True or False, enter the accepted number range, pick each
          match from its dropdown, or write ordering steps in the numbered
          sequence. Save the homework when you are done.
        </p>
        {homework.map((item) => (
          <QuizItemEditor
            key={item.id}
            item={item}
            canRemove={homework.length > 1}
            onChange={(next) =>
              onChangeHomework(
                homework.map((row) => (row.id === next.id ? next : row)),
              )
            }
            onRemove={() =>
              onChangeHomework(homework.filter((row) => row.id !== item.id))
            }
          />
        ))}
      </div>

      {attempts.length > 0 ? (
        <div>
          <h4 className="mb-3 text-base font-semibold">Homework attempts</h4>
          <ul className="divide-y divide-[var(--border-hairline)] rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
            {attempts.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="font-medium">{row.studentName}</span>
                <div className="flex items-center gap-3">
                  <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--text-secondary)]">
                    {row.correctCount}/{row.totalQuestions}
                  </span>
                  <GradePill grade={row.gradeFiveScale} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
