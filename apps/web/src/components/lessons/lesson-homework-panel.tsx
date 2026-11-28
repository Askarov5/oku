"use client";

import { Button, TrashIcon, fieldClass } from "@oku/ui";
import type { ReactElement } from "react";
import { useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  PlusIcon,
} from "@/components/lessons/lesson-icons";
import type { HomeworkItem } from "@/lib/lesson-studio";

interface LessonHomeworkPanelProps {
  lessonTitle: string;
  homework: HomeworkItem[];
  onChangeHomework: (items: HomeworkItem[]) => void;
}

export const LessonHomeworkPanel = ({
  lessonTitle,
  homework,
  onChangeHomework,
}: LessonHomeworkPanelProps): ReactElement => {
  const [showAnswers, setShowAnswers] = useState(true);
  const [copied, setCopied] = useState(false);

  const totalMinutes = homework.reduce(
    (sum, item) => sum + item.expectedMinutes,
    0,
  );

  const updateItem = (id: string, patch: Partial<HomeworkItem>): void => {
    onChangeHomework(
      homework.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const addProblem = (): void => {
    const nextNum = homework.length + 1;
    onChangeHomework([
      ...homework,
      {
        id: `hw-custom-${Date.now()}`,
        title: `${nextNum}. Practice Problem`,
        prompt: "Describe the student task or calculation.",
        expectedMinutes: 8,
        answerGuide: "Expected solution steps and final answer.",
      },
    ]);
  };

  const removeProblem = (id: string): void => {
    if (homework.length <= 1) return;
    onChangeHomework(homework.filter((item) => item.id !== id));
  };

  const copyStudentSheet = async (): Promise<void> => {
    const text = [
      `Homework — ${lessonTitle}`,
      "",
      ...homework.map(
        (item) => `${item.title} (~${item.expectedMinutes} min)\n${item.prompt}`,
      ),
    ].join("\n\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Take-home practice</h3>
          <p className="mt-0.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
            {homework.length} {homework.length === 1 ? "task" : "tasks"} · ~
            {totalMinutes} min total
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnswers((prev) => !prev)}
          >
            {showAnswers ? "Hide answer key" : "Show answer key"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copyStudentSheet()}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied student tasks" : "Copy for class group"}
          </Button>
          <Button variant="ghost" size="sm" onClick={addProblem}>
            <PlusIcon />
            Add task
          </Button>
        </div>
      </div>

      <ol className="divide-y divide-[var(--border-hairline)] rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        {homework.map((item) => (
          <li key={item.id} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <input
                type="text"
                aria-label="Homework item title"
                value={item.title}
                onChange={(event) =>
                  updateItem(item.id, { title: event.target.value })
                }
                className={`${fieldClass} max-w-xl font-semibold`}
              />
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={item.expectedMinutes}
                    onChange={(event) =>
                      updateItem(item.id, {
                        expectedMinutes: Math.max(
                          2,
                          Number(event.target.value) || 5,
                        ),
                      })
                    }
                    className="w-16 rounded-[var(--rounded-xs)] border border-[var(--border-control)] bg-[var(--bg-canvas)] px-2 py-1.5 text-right font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-primary)] coarse:min-h-[44px]"
                  />
                  <span>min</span>
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${item.title}`}
                  disabled={homework.length <= 1}
                  onClick={() => removeProblem(item.id)}
                >
                  <TrashIcon />
                </Button>
              </div>
            </div>

            <textarea
              rows={2}
              aria-label="Student prompt"
              value={item.prompt}
              onChange={(event) =>
                updateItem(item.id, { prompt: event.target.value })
              }
              className={`${fieldClass} mt-3 leading-6`}
            />

            {showAnswers ? (
              <div className="mt-3">
                <label
                  htmlFor={`hw-ans-${item.id}`}
                  className="text-xs font-medium text-[var(--text-secondary)]"
                >
                  Teacher answer key (excluded when copying student tasks)
                </label>
                <input
                  id={`hw-ans-${item.id}`}
                  type="text"
                  value={item.answerGuide}
                  onChange={(event) =>
                    updateItem(item.id, { answerGuide: event.target.value })
                  }
                  className={`${fieldClass} mt-1`}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
};
