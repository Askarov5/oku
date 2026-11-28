"use client";

import { Button, TrashIcon, fieldClass } from "@oku/ui";
import type { ReactElement } from "react";
import type { QuizItem, QuizItemKind } from "@/lib/quiz";
import { CHOICE_SHAPES, DEFAULT_TIME_LIMITS } from "@/lib/quiz";
import { QUIZ_KIND_LABELS } from "./quiz-kinds";
import { ShapeMark } from "./shape-mark";

interface QuizItemEditorProps {
  item: QuizItem;
  onChange: (item: QuizItem) => void;
  onRemove?: () => void;
  canRemove?: boolean;
}

export const createBlankQuizItem = (kind: QuizItemKind): QuizItem => {
  const id = `q-${Date.now()}`;
  const base = {
    id,
    prompt: "New question",
    scenarioNote: null as string | null,
    explanation: "",
    timeLimitSec: DEFAULT_TIME_LIMITS[kind],
    points: 1000,
    requireExplanation: false,
  };
  switch (kind) {
    case "multiple_choice":
      return {
        ...base,
        kind,
        choices: CHOICE_SHAPES.map((shape, index) => ({
          id: `${id}-${index}`,
          shape,
          text: `Option ${index + 1}`,
        })),
        answer: { correctChoiceId: `${id}-0` },
      };
    case "checkboxes":
      return {
        ...base,
        kind,
        choices: [0, 1, 2, 3].map((index) => ({
          id: `${id}-${index}`,
          text: `Option ${index + 1}`,
        })),
        answer: { correctChoiceIds: [`${id}-0`, `${id}-1`] },
      };
    case "true_false":
      return { ...base, kind, answer: { correct: true } };
    case "numeric_range":
      return {
        ...base,
        kind,
        unit: null,
        answer: { min: 0, max: 1 },
      };
    case "matching":
      return {
        ...base,
        kind,
        prompts: [
          { id: `${id}-p1`, text: "Prompt 1" },
          { id: `${id}-p2`, text: "Prompt 2" },
          { id: `${id}-p3`, text: "Prompt 3" },
        ],
        options: [
          { id: `${id}-o1`, text: "Option 1" },
          { id: `${id}-o2`, text: "Option 2" },
          { id: `${id}-o3`, text: "Option 3" },
        ],
        answer: {
          pairs: {
            [`${id}-p1`]: `${id}-o1`,
            [`${id}-p2`]: `${id}-o2`,
            [`${id}-p3`]: `${id}-o3`,
          },
        },
      };
    case "ordering":
      return {
        ...base,
        kind,
        items: [
          { id: `${id}-i1`, text: "First" },
          { id: `${id}-i2`, text: "Second" },
          { id: `${id}-i3`, text: "Third" },
        ],
        answer: { order: [`${id}-i1`, `${id}-i2`, `${id}-i3`] },
      };
  }
};

export const QuizItemEditor = ({
  item,
  onChange,
  onRemove,
  canRemove = true,
}: QuizItemEditorProps): ReactElement => {
  return (
    <article
      id={`quiz-item-${item.id}`}
      className="space-y-4 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs">
          {QUIZ_KIND_LABELS[item.kind]}
        </span>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <input
              type="number"
              min={5}
              max={120}
              value={item.timeLimitSec}
              className="w-16 rounded-[var(--rounded-xs)] border border-[var(--border-control)] bg-[var(--bg-canvas)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs tabular-nums"
              onChange={(event) =>
                onChange({
                  ...item,
                  timeLimitSec: Math.max(5, Number(event.target.value) || 20),
                })
              }
            />
            sec
          </label>
          {onRemove ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete question"
              disabled={!canRemove}
              onClick={onRemove}
            >
              <TrashIcon />
            </Button>
          ) : null}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          Prompt
        </span>
        <textarea
          className={fieldClass}
          rows={2}
          value={item.prompt}
          onChange={(event) => onChange({ ...item, prompt: event.target.value })}
        />
      </label>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={item.requireExplanation}
          onChange={(event) =>
            onChange({ ...item, requireExplanation: event.target.checked })
          }
        />
        Require explanation
      </label>

      {item.kind === "multiple_choice" || item.kind === "checkboxes" ? (
        <div className="space-y-2">
          {item.choices.map((choice) => {
            const isCorrect =
              item.kind === "multiple_choice"
                ? item.answer?.correctChoiceId === choice.id
                : (item.answer?.correctChoiceIds ?? []).includes(choice.id);
            return (
              <div key={choice.id} className="flex items-center gap-2">
                {item.kind === "multiple_choice" && choice.shape ? (
                  <span className="text-[var(--text-secondary)]">
                    <ShapeMark shape={choice.shape} />
                  </span>
                ) : null}
                <input
                  type={item.kind === "multiple_choice" ? "radio" : "checkbox"}
                  name={`${item.id}-correct`}
                  checked={isCorrect}
                  aria-label="Mark correct"
                  onChange={() => {
                    if (item.kind === "multiple_choice") {
                      onChange({
                        ...item,
                        answer: { correctChoiceId: choice.id },
                      });
                    } else {
                      const current = new Set(item.answer?.correctChoiceIds ?? []);
                      if (current.has(choice.id)) current.delete(choice.id);
                      else current.add(choice.id);
                      onChange({
                        ...item,
                        answer: { correctChoiceIds: [...current] },
                      });
                    }
                  }}
                />
                <input
                  className={`${fieldClass} flex-1`}
                  value={choice.text}
                  onChange={(event) => {
                    const text = event.target.value;
                    onChange({
                      ...item,
                      choices: item.choices.map((row) =>
                        row.id === choice.id ? { ...row, text } : row,
                      ),
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {item.kind === "true_false" ? (
        <div className="flex gap-3">
          {[true, false].map((value) => (
            <label key={String(value)} className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${item.id}-tf`}
                checked={item.answer?.correct === value}
                onChange={() => onChange({ ...item, answer: { correct: value } })}
              />
              {value ? "True" : "False"}
            </label>
          ))}
        </div>
      ) : null}

      {item.kind === "numeric_range" ? (
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Min{" "}
            <input
              type="number"
              className={fieldClass}
              value={item.answer?.min ?? 0}
              onChange={(event) =>
                onChange({
                  ...item,
                  answer: {
                    min: Number(event.target.value),
                    max: item.answer?.max ?? 0,
                  },
                })
              }
            />
          </label>
          <label className="text-sm">
            Max{" "}
            <input
              type="number"
              className={fieldClass}
              value={item.answer?.max ?? 0}
              onChange={(event) =>
                onChange({
                  ...item,
                  answer: {
                    min: item.answer?.min ?? 0,
                    max: Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label className="text-sm">
            Unit{" "}
            <input
              className={fieldClass}
              value={item.unit ?? ""}
              onChange={(event) =>
                onChange({
                  ...item,
                  unit: event.target.value || null,
                })
              }
            />
          </label>
        </div>
      ) : null}

      {item.kind === "matching" ? (
        <div className="space-y-2 text-sm">
          {item.prompts.map((prompt) => (
            <div key={prompt.id} className="grid gap-2 sm:grid-cols-2">
              <input
                className={fieldClass}
                value={prompt.text}
                onChange={(event) =>
                  onChange({
                    ...item,
                    prompts: item.prompts.map((row) =>
                      row.id === prompt.id
                        ? { ...row, text: event.target.value }
                        : row,
                    ),
                  })
                }
              />
              <select
                className={fieldClass}
                value={item.answer?.pairs[prompt.id] ?? ""}
                onChange={(event) =>
                  onChange({
                    ...item,
                    answer: {
                      pairs: {
                        ...(item.answer?.pairs ?? {}),
                        [prompt.id]: event.target.value,
                      },
                    },
                  })
                }
              >
                {item.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.text}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : null}

      {item.kind === "ordering" ? (
        <ol className="space-y-2">
          {(item.answer?.order ?? item.items.map((row) => row.id)).map(
            (id, index) => {
              const row = item.items.find((entry) => entry.id === id);
              if (!row) return null;
              return (
                <li key={id} className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums">
                    {index + 1}.
                  </span>
                  <input
                    className={`${fieldClass} flex-1`}
                    value={row.text}
                    onChange={(event) =>
                      onChange({
                        ...item,
                        items: item.items.map((entry) =>
                          entry.id === id
                            ? { ...entry, text: event.target.value }
                            : entry,
                        ),
                      })
                    }
                  />
                </li>
              );
            },
          )}
        </ol>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          Teacher explanation
        </span>
        <textarea
          className={fieldClass}
          rows={2}
          value={item.explanation}
          onChange={(event) =>
            onChange({ ...item, explanation: event.target.value })
          }
        />
      </label>
    </article>
  );
};
