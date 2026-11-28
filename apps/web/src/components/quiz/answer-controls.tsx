"use client";

import { useState, type ReactElement } from "react";
import type {
  CheckboxesItem,
  MatchingItem,
  MultipleChoiceItem,
  NumericRangeItem,
  OrderingItemQuestion,
  QuizItem,
  QuizResponse,
  TrueFalseItem,
} from "@/lib/quiz";
import { CHOICE_BUTTON_CLASS, ShapeMark } from "./shape-mark";

interface ControlProps {
  question: QuizItem;
  locked: boolean;
  draft: QuizResponse | null;
  onChange: (response: QuizResponse) => void;
  onLock?: () => void;
}

const baseChoice =
  "flex min-h-[76px] items-center gap-3 rounded-[var(--rounded-xs)] px-4 py-3 text-left text-base font-semibold transition coarse:min-h-[44px]";

export const MultipleChoiceControl = ({
  question,
  locked,
  draft,
  onChange,
  onLock,
}: {
  question: MultipleChoiceItem;
  locked: boolean;
  draft: QuizResponse | null;
  onChange: (response: QuizResponse) => void;
  onLock?: () => void;
}): ReactElement => {
  const selected =
    draft?.kind === "multiple_choice" ? draft.choiceId : null;
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Choices">
      {question.choices.map((choice) => {
        const shape = choice.shape ?? "square";
        const isSelected = selected === choice.id;
        return (
          <button
            key={choice.id}
            type="button"
            disabled={locked}
            className={`${baseChoice} ${CHOICE_BUTTON_CLASS[shape]} ${
              isSelected ? "ring-2 ring-[var(--text-primary)] ring-offset-2" : ""
            }`}
            onClick={() => {
              const next: QuizResponse = {
                kind: "multiple_choice",
                questionId: question.id,
                choiceId: choice.id,
                elapsedSec: draft?.elapsedSec ?? 0,
                reasoning: draft?.reasoning,
              };
              onChange(next);
              onLock?.();
            }}
          >
            <ShapeMark shape={shape} className="size-5 shrink-0" />
            <span>{choice.text}</span>
          </button>
        );
      })}
    </div>
  );
};

export const TrueFalseControl = ({
  question,
  locked,
  draft,
  onChange,
  onLock,
}: {
  question: TrueFalseItem;
  locked: boolean;
  draft: QuizResponse | null;
  onChange: (response: QuizResponse) => void;
  onLock?: () => void;
}): ReactElement => {
  const selected = draft?.kind === "true_false" ? draft.value : null;
  const options: Array<{ value: boolean; label: string; shape: "triangle" | "diamond" }> =
    [
      { value: true, label: "True", shape: "triangle" },
      { value: false, label: "False", shape: "diamond" },
    ];
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="True or false">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          disabled={locked}
          className={`${baseChoice} ${CHOICE_BUTTON_CLASS[option.shape]} ${
            selected === option.value
              ? "ring-2 ring-[var(--text-primary)] ring-offset-2"
              : ""
          }`}
          onClick={() => {
            const next: QuizResponse = {
              kind: "true_false",
              questionId: question.id,
              value: option.value,
              elapsedSec: draft?.elapsedSec ?? 0,
              reasoning: draft?.reasoning,
            };
            onChange(next);
            onLock?.();
          }}
        >
          <ShapeMark shape={option.shape} className="size-5 shrink-0" />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
};

export const CheckboxesControl = ({
  question,
  locked,
  draft,
  onChange,
}: {
  question: CheckboxesItem;
  locked: boolean;
  draft: QuizResponse | null;
  onChange: (response: QuizResponse) => void;
}): ReactElement => {
  const selected =
    draft?.kind === "checkboxes" ? new Set(draft.choiceIds) : new Set<string>();
  return (
    <div className="space-y-2" role="group" aria-label="Select all that apply">
      {question.choices.map((choice) => {
        const checked = selected.has(choice.id);
        return (
          <label
            key={choice.id}
            className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 ${
              locked ? "opacity-70" : ""
            }`}
          >
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent-secondary)]"
              checked={checked}
              disabled={locked}
              onChange={() => {
                const next = new Set(selected);
                if (checked) next.delete(choice.id);
                else next.add(choice.id);
                onChange({
                  kind: "checkboxes",
                  questionId: question.id,
                  choiceIds: [...next],
                  elapsedSec: draft?.elapsedSec ?? 0,
                  reasoning: draft?.reasoning,
                });
              }}
            />
            <span className="text-sm font-medium">{choice.text}</span>
          </label>
        );
      })}
    </div>
  );
};

export const NumericRangeControl = ({
  question,
  locked,
  draft,
  onChange,
}: {
  question: NumericRangeItem;
  locked: boolean;
  draft: QuizResponse | null;
  onChange: (response: QuizResponse) => void;
}): ReactElement => {
  const value = draft?.kind === "numeric_range" ? draft.value : "";
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="decimal"
        disabled={locked}
        value={value}
        aria-label="Numeric answer"
        placeholder="Enter a number"
        className="min-h-[44px] w-full max-w-xs rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 font-[family-name:var(--font-mono)] text-base tabular-nums"
        onChange={(event) =>
          onChange({
            kind: "numeric_range",
            questionId: question.id,
            value: event.target.value,
            elapsedSec: draft?.elapsedSec ?? 0,
            reasoning: draft?.reasoning,
          })
        }
      />
      {question.unit ? (
        <span className="font-[family-name:var(--font-mono)] text-sm text-[var(--text-secondary)]">
          {question.unit}
        </span>
      ) : null}
    </div>
  );
};

export const MatchingControl = ({
  question,
  locked,
  draft,
  onChange,
  promptOrder,
  optionOrder,
}: {
  question: MatchingItem;
  locked: boolean;
  draft: QuizResponse | null;
  onChange: (response: QuizResponse) => void;
  promptOrder: string[];
  optionOrder: string[];
}): ReactElement => {
  const pairs = draft?.kind === "matching" ? draft.pairs : {};
  const usedOptions = new Set(Object.values(pairs));
  const activePrompt =
    draft && "activePromptId" in (draft as object)
      ? ((draft as { activePromptId?: string }).activePromptId ?? null)
      : null;

  // Local selection state via pairs + a data attribute on draft through a side channel
  // We keep active prompt in a simple approach: first unpaired click selects prompt.
  return (
    <MatchingBoard
      question={question}
      locked={locked}
      pairs={pairs}
      promptOrder={promptOrder}
      optionOrder={optionOrder}
      usedOptions={usedOptions}
      onChangePairs={(nextPairs) =>
        onChange({
          kind: "matching",
          questionId: question.id,
          pairs: nextPairs,
          elapsedSec: draft?.elapsedSec ?? 0,
          reasoning: draft?.reasoning,
        })
      }
      activePrompt={activePrompt}
    />
  );
};

const MatchingBoard = ({
  question,
  locked,
  pairs,
  promptOrder,
  optionOrder,
  usedOptions,
  onChangePairs,
}: {
  question: MatchingItem;
  locked: boolean;
  pairs: Record<string, string>;
  promptOrder: string[];
  optionOrder: string[];
  usedOptions: Set<string>;
  onChangePairs: (pairs: Record<string, string>) => void;
  activePrompt: string | null;
}): ReactElement => {
  const promptsById = new Map(question.prompts.map((p) => [p.id, p]));
  const optionsById = new Map(question.options.map((o) => [o.id, o]));
  // Use React state via closure through parent re-renders — keep selected prompt in component state
  return (
    <MatchingBoardInner
      locked={locked}
      pairs={pairs}
      promptOrder={promptOrder}
      optionOrder={optionOrder}
      usedOptions={usedOptions}
      promptsById={promptsById}
      optionsById={optionsById}
      onChangePairs={onChangePairs}
    />
  );
};

const MatchingBoardInner = ({
  locked,
  pairs,
  promptOrder,
  optionOrder,
  usedOptions,
  promptsById,
  optionsById,
  onChangePairs,
}: {
  locked: boolean;
  pairs: Record<string, string>;
  promptOrder: string[];
  optionOrder: string[];
  usedOptions: Set<string>;
  promptsById: Map<string, { id: string; text: string }>;
  optionsById: Map<string, { id: string; text: string }>;
  onChangePairs: (pairs: Record<string, string>) => void;
}): ReactElement => {
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2" role="list" aria-label="Prompts">
        {promptOrder.map((id) => {
          const prompt = promptsById.get(id);
          if (!prompt) return null;
          const paired = pairs[id];
          const option = paired ? optionsById.get(paired) : null;
          return (
            <button
              key={id}
              type="button"
              role="listitem"
              disabled={locked}
              className={`flex min-h-[44px] w-full items-center justify-between rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-left text-sm ${
                selectedPromptId === id
                  ? "border-[var(--accent-primary)] border-l-4"
                  : ""
              }`}
              onClick={() => {
                if (paired) {
                  const next = { ...pairs };
                  delete next[id];
                  onChangePairs(next);
                  setSelectedPromptId(id);
                  return;
                }
                setSelectedPromptId(id);
              }}
            >
              <span className="font-medium">{prompt.text}</span>
              {option ? (
                <span className="text-[var(--text-secondary)]">{option.text}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="space-y-2" role="list" aria-label="Options">
        {optionOrder.map((id) => {
          const option = optionsById.get(id);
          if (!option) return null;
          const taken = usedOptions.has(id);
          return (
            <button
              key={id}
              type="button"
              role="listitem"
              disabled={locked || taken || !selectedPromptId}
              className={`flex min-h-[44px] w-full items-center rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-left text-sm ${
                taken ? "opacity-40" : ""
              }`}
              onClick={() => {
                if (!selectedPromptId) return;
                onChangePairs({ ...pairs, [selectedPromptId]: id });
                setSelectedPromptId(null);
              }}
            >
              {option.text}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const OrderingControl = ({
  question,
  locked,
  draft,
  onChange,
}: {
  question: OrderingItemQuestion;
  locked: boolean;
  draft: QuizResponse | null;
  onChange: (response: QuizResponse) => void;
}): ReactElement => {
  const order =
    draft?.kind === "ordering" && draft.order.length > 0
      ? draft.order
      : question.items.map((item) => item.id);
  const byId = new Map(question.items.map((item) => [item.id, item]));

  const move = (index: number, delta: number): void => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    onChange({
      kind: "ordering",
      questionId: question.id,
      order: next,
      elapsedSec: draft?.elapsedSec ?? 0,
      reasoning: draft?.reasoning,
    });
  };

  return (
    <ol className="space-y-2">
      {order.map((id, index) => {
        const item = byId.get(id);
        if (!item) return null;
        return (
          <li
            key={id}
            className="flex min-h-[44px] items-center gap-2 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2"
          >
            <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
              {index + 1}
            </span>
            <span className="flex-1 text-sm font-medium">{item.text}</span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={locked || index === 0}
                className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] px-2 py-1 text-xs disabled:opacity-40"
                aria-label="Move up"
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={locked || index === order.length - 1}
                className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] px-2 py-1 text-xs disabled:opacity-40"
                aria-label="Move down"
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export const AnswerControl = (props: ControlProps & {
  promptOrder?: string[];
  optionOrder?: string[];
}): ReactElement => {
  const { question } = props;
  switch (question.kind) {
    case "multiple_choice":
      return (
        <MultipleChoiceControl
          question={question}
          locked={props.locked}
          draft={props.draft}
          onChange={props.onChange}
          onLock={props.onLock}
        />
      );
    case "true_false":
      return (
        <TrueFalseControl
          question={question}
          locked={props.locked}
          draft={props.draft}
          onChange={props.onChange}
          onLock={props.onLock}
        />
      );
    case "checkboxes":
      return (
        <CheckboxesControl
          question={question}
          locked={props.locked}
          draft={props.draft}
          onChange={props.onChange}
        />
      );
    case "numeric_range":
      return (
        <NumericRangeControl
          question={question}
          locked={props.locked}
          draft={props.draft}
          onChange={props.onChange}
        />
      );
    case "matching":
      return (
        <MatchingControl
          question={question}
          locked={props.locked}
          draft={props.draft}
          onChange={props.onChange}
          promptOrder={props.promptOrder ?? question.prompts.map((p) => p.id)}
          optionOrder={props.optionOrder ?? question.options.map((o) => o.id)}
        />
      );
    case "ordering":
      return (
        <OrderingControl
          question={question}
          locked={props.locked}
          draft={props.draft}
          onChange={props.onChange}
        />
      );
  }
};

export const responseIsReady = (
  question: QuizItem,
  draft: QuizResponse | null,
): boolean => {
  if (!draft || draft.kind !== question.kind) return false;
  if (question.requireExplanation && !draft.reasoning?.trim()) return false;
  switch (question.kind) {
    case "multiple_choice":
      return draft.kind === "multiple_choice" && draft.choiceId !== null;
    case "true_false":
      return draft.kind === "true_false" && draft.value !== null;
    case "checkboxes":
      return draft.kind === "checkboxes" && draft.choiceIds.length > 0;
    case "numeric_range":
      return draft.kind === "numeric_range" && draft.value.trim().length > 0;
    case "matching":
      return (
        draft.kind === "matching" &&
        question.prompts.every((p) => Boolean(draft.pairs[p.id]))
      );
    case "ordering":
      return draft.kind === "ordering" && draft.order.length === question.items.length;
  }
};

export const locksOnTap = (question: QuizItem): boolean =>
  !question.requireExplanation &&
  (question.kind === "multiple_choice" || question.kind === "true_false");
