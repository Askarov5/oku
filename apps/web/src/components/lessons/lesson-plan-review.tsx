"use client";

import {
  Button,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  TrashIcon,
  fieldClass,
} from "@oku/ui";
import type { ReactElement } from "react";
import { useState } from "react";
import { PlusIcon, SparklesIcon } from "@/components/lessons/lesson-icons";
import type { LessonPlanBlock, LessonWorkspace } from "@/lib/lesson-studio";
import {
  DEFAULT_HOMEWORK_COUNT,
  DEFAULT_QUIZ_COUNT,
  DEFAULT_SLIDE_COUNT,
  DELIVERABLE_COUNT_MAX,
  DELIVERABLE_COUNT_MIN,
  resolveHomeworkCount,
  resolveQuizCount,
  resolveSlideCount,
} from "@/lib/lesson-studio";

type DeliverableToggleKey = "slides" | "kahootTest" | "homework";
type DeliverableCountKey = "slideCount" | "quizCount" | "homeworkCount";

interface LessonPlanReviewProps {
  workspace: LessonWorkspace;
  generatingMaterials: boolean;
  onBackToSetup: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdatePlanBlock: (blockId: string, patch: Partial<LessonPlanBlock>) => void;
  onReplacePlanBlocks: (blocks: LessonPlanBlock[]) => void;
  onToggleDeliverable: (key: DeliverableToggleKey) => void;
  onUpdateDeliverableCount: (key: DeliverableCountKey, value: number) => void;
  onGenerateMaterials: () => void;
}

export const LessonPlanReview = ({
  workspace,
  generatingMaterials,
  onBackToSetup,
  onUpdateTitle,
  onUpdatePlanBlock,
  onReplacePlanBlocks,
  onToggleDeliverable,
  onUpdateDeliverableCount,
  onGenerateMaterials,
}: LessonPlanReviewProps): ReactElement => {
  const [activeLessonTab, setActiveLessonTab] = useState(1);
  const [fieldFocused, setFieldFocused] = useState(false);

  const lessonNumbers = Array.from(
    new Set(workspace.planBlocks.map((block) => block.lessonNumber)),
  ).sort((a, b) => a - b);

  const safeTab =
    lessonNumbers.includes(activeLessonTab)
      ? activeLessonTab
      : (lessonNumbers[0] ?? 1);

  const visibleBlocks = workspace.planBlocks.filter(
    (block) => block.lessonNumber === safeTab,
  );

  const totalPlannedMinutes = visibleBlocks.reduce(
    (sum, block) => sum + block.minutes,
    0,
  );

  const minutesDelta = totalPlannedMinutes - workspace.minutesPerLesson;
  const minutesWarning =
    Math.abs(minutesDelta) >= Math.max(5, Math.round(workspace.minutesPerLesson * 0.15));

  const anyDeliverableChecked =
    workspace.deliverables.slides ||
    workspace.deliverables.kahootTest ||
    workspace.deliverables.homework;

  const moveBlock = (blockId: string, direction: -1 | 1): void => {
    const indexes = workspace.planBlocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.lessonNumber === safeTab);
    const position = indexes.findIndex(({ block }) => block.id === blockId);
    if (position < 0) return;
    const swapWith = position + direction;
    if (swapWith < 0 || swapWith >= indexes.length) return;

    const next = [...workspace.planBlocks];
    const from = indexes[position]!.index;
    const to = indexes[swapWith]!.index;
    const tmp = next[from]!;
    next[from] = next[to]!;
    next[to] = tmp;
    onReplacePlanBlocks(next);
  };

  const deleteBlock = (blockId: string): void => {
    if (visibleBlocks.length <= 1) return;
    onReplacePlanBlocks(
      workspace.planBlocks.filter((block) => block.id !== blockId),
    );
  };

  const addBlock = (): void => {
    const created: LessonPlanBlock = {
      id: `plan-${safeTab}-${Date.now()}`,
      lessonNumber: safeTab,
      title: "New section",
      minutes: 5,
      pageRef: workspace.pageRangeLabel || null,
      explanation: "Describe what happens in this section of the lesson.",
      teacherNote: "Add a classroom cue for yourself.",
    };
    const lastInLesson = [...workspace.planBlocks]
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.lessonNumber === safeTab)
      .at(-1);
    const next = [...workspace.planBlocks];
    const insertAt = lastInLesson ? lastInLesson.index + 1 : next.length;
    next.splice(insertAt, 0, created);
    onReplacePlanBlocks(next);
  };

  const materialsLabel = generatingMaterials
    ? "Building slides & quiz…"
    : "Generate materials → Preview";

  return (
    <div
      className="pb-[calc(8.25rem+env(safe-area-inset-bottom))] lg:pb-0"
      onFocusCapture={(event) => {
        const tag =
          event.target instanceof HTMLElement ? event.target.tagName : "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
          setFieldFocused(true);
        }
      }}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
          setFieldFocused(false);
        }
      }}
    >
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="review-plan-heading">
        <button
          type="button"
          onClick={onBackToSetup}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-ink)]"
        >
          <ChevronLeftIcon />
          Edit unit &amp; angle
        </button>

        <label htmlFor="lesson-title-input" className="sr-only">
          Lesson title
        </label>
        <input
          id="lesson-title-input"
          type="text"
          value={workspace.title}
          onChange={(event) => onUpdateTitle(event.target.value)}
          className="mt-2 w-full border-0 bg-transparent text-2xl font-bold tracking-[-0.02em] outline-none focus:ring-0"
        />
        <p
          id="review-plan-heading"
          className="mt-1 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]"
        >
          {workspace.unitTitle} · {workspace.pageRangeLabel} ·{" "}
          {workspace.audience} · {totalPlannedMinutes} min planned
          {minutesWarning
            ? ` (target ${workspace.minutesPerLesson} min)`
            : ""}
        </p>
        {minutesWarning ? (
          <p className="mt-2 text-sm text-[var(--status-failed)]">
            Planned time is {Math.abs(minutesDelta)} min{" "}
            {minutesDelta > 0 ? "over" : "under"} the{" "}
            {workspace.minutesPerLesson}-minute target for this lesson part.
          </p>
        ) : null}

        {workspace.creativeAngle.trim() ? (
          <p className="mt-3 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3 text-sm leading-6">
            <span className="font-semibold">Active angle: </span>
            {workspace.creativeAngle}
          </p>
        ) : null}

        {lessonNumbers.length > 1 ? (
          <div
            role="tablist"
            aria-label="Lesson parts"
            className="-mx-4 mt-5 flex gap-2 overflow-x-auto border-b border-[var(--border-hairline)] px-4 pb-3 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {lessonNumbers.map((num) => {
              const selected = num === safeTab;
              return (
                <button
                  key={num}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => setActiveLessonTab(num)}
                  className={`min-h-11 shrink-0 rounded-[var(--rounded-xs)] border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    selected
                      ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                      : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  Lesson {num} of {lessonNumbers.length}
                </button>
              );
            })}
          </div>
        ) : null}

        <ol className="mt-6 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          {visibleBlocks.map((block, idx) => {
            const lineEstimate = Math.max(
              4,
              Math.ceil(block.explanation.length / 64),
            );
            return (
              <li
                key={block.id}
                className={
                  idx > 0
                    ? "border-t border-[var(--border-hairline)] p-5"
                    : "p-5"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="font-[family-name:var(--font-mono)] text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      aria-label={`Section ${idx + 1} title`}
                      value={block.title}
                      onChange={(event) =>
                        onUpdatePlanBlock(block.id, {
                          title: event.target.value,
                        })
                      }
                      className={`${fieldClass} font-semibold`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                      <input
                        type="number"
                        min={1}
                        max={90}
                        aria-label={`Minutes for section ${idx + 1}`}
                        value={block.minutes}
                        onChange={(event) =>
                          onUpdatePlanBlock(block.id, {
                            minutes: Math.max(
                              1,
                              Number(event.target.value) || 1,
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
                      aria-label="Move section up"
                      disabled={idx === 0}
                      onClick={() => moveBlock(block.id, -1)}
                    >
                      <ChevronUpIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Move section down"
                      disabled={idx >= visibleBlocks.length - 1}
                      onClick={() => moveBlock(block.id, 1)}
                    >
                      <ChevronDownIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete section"
                      disabled={visibleBlocks.length <= 1}
                      onClick={() => deleteBlock(block.id)}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <label
                    htmlFor={`page-${block.id}`}
                    className="block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Page reference
                  </label>
                  <input
                    id={`page-${block.id}`}
                    type="text"
                    value={block.pageRef ?? ""}
                    onChange={(event) =>
                      onUpdatePlanBlock(block.id, {
                        pageRef: event.target.value.trim() || null,
                      })
                    }
                    placeholder="e.g. pp. 42–46"
                    className={`${fieldClass} mt-1.5 font-[family-name:var(--font-mono)] text-sm`}
                  />
                </div>

                <div className="mt-3">
                  <label htmlFor={`exp-${block.id}`} className="sr-only">
                    Teaching explanation
                  </label>
                  <textarea
                    id={`exp-${block.id}`}
                    rows={lineEstimate}
                    value={block.explanation}
                    onChange={(event) =>
                      onUpdatePlanBlock(block.id, {
                        explanation: event.target.value,
                      })
                    }
                    className={`${fieldClass} leading-6`}
                  />
                </div>

                <div className="mt-3">
                  <label
                    htmlFor={`note-${block.id}`}
                    className="block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Classroom cue
                  </label>
                  <textarea
                    id={`note-${block.id}`}
                    rows={2}
                    value={block.teacherNote}
                    onChange={(event) =>
                      onUpdatePlanBlock(block.id, {
                        teacherNote: event.target.value,
                      })
                    }
                    className={`${fieldClass} mt-1.5 text-sm leading-5`}
                  />
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={addBlock}>
            <PlusIcon />
            Add section
          </Button>
        </div>
      </section>

      <aside
        aria-labelledby="approve-materials-heading"
        className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 lg:sticky lg:top-6"
      >
        <h3 id="approve-materials-heading" className="text-lg font-semibold">
          Generate teaching materials
        </h3>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
          Checked items are built from this plan, then open in Preview before
          Teaching Studio.
        </p>

        <div className="mt-4 flex flex-col gap-4 border-y border-[var(--border-hairline)] py-4">
          <div className="flex flex-col gap-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={workspace.deliverables.slides}
                onChange={() => onToggleDeliverable("slides")}
                className="size-6 shrink-0 rounded-[var(--rounded-xs)]"
              />
              Slides &amp; classroom visuals
            </label>
            {workspace.deliverables.slides ? (
              <label className="ml-9 flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                <span>Teaching slides</span>
                <input
                  type="number"
                  min={DELIVERABLE_COUNT_MIN}
                  max={DELIVERABLE_COUNT_MAX}
                  aria-label="Number of teaching slides"
                  value={resolveSlideCount(workspace.deliverables)}
                  onChange={(event) =>
                    onUpdateDeliverableCount(
                      "slideCount",
                      Math.min(
                        DELIVERABLE_COUNT_MAX,
                        Math.max(
                          DELIVERABLE_COUNT_MIN,
                          Number(event.target.value) || DEFAULT_SLIDE_COUNT,
                        ),
                      ),
                    )
                  }
                  className="w-16 rounded-[var(--rounded-xs)] border border-[var(--border-control)] bg-[var(--bg-canvas)] px-2 py-1.5 text-right font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-primary)] coarse:min-h-[44px]"
                />
              </label>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={workspace.deliverables.kahootTest}
                onChange={() => onToggleDeliverable("kahootTest")}
                className="size-6 shrink-0 rounded-[var(--rounded-xs)]"
              />
              Student quiz (shareable &amp; auto-graded)
            </label>
            {workspace.deliverables.kahootTest ? (
              <label className="ml-9 flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                <span>Quiz questions</span>
                <input
                  type="number"
                  min={DELIVERABLE_COUNT_MIN}
                  max={DELIVERABLE_COUNT_MAX}
                  aria-label="Number of quiz questions"
                  value={resolveQuizCount(workspace.deliverables)}
                  onChange={(event) =>
                    onUpdateDeliverableCount(
                      "quizCount",
                      Math.min(
                        DELIVERABLE_COUNT_MAX,
                        Math.max(
                          DELIVERABLE_COUNT_MIN,
                          Number(event.target.value) || DEFAULT_QUIZ_COUNT,
                        ),
                      ),
                    )
                  }
                  className="w-16 rounded-[var(--rounded-xs)] border border-[var(--border-control)] bg-[var(--bg-canvas)] px-2 py-1.5 text-right font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-primary)] coarse:min-h-[44px]"
                />
              </label>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={workspace.deliverables.homework}
                onChange={() => onToggleDeliverable("homework")}
                className="size-6 shrink-0 rounded-[var(--rounded-xs)]"
              />
              Homework practice &amp; key
            </label>
            {workspace.deliverables.homework ? (
              <label className="ml-9 flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                <span>Practice items</span>
                <input
                  type="number"
                  min={DELIVERABLE_COUNT_MIN}
                  max={DELIVERABLE_COUNT_MAX}
                  aria-label="Number of homework practices"
                  value={resolveHomeworkCount(workspace.deliverables)}
                  onChange={(event) =>
                    onUpdateDeliverableCount(
                      "homeworkCount",
                      Math.min(
                        DELIVERABLE_COUNT_MAX,
                        Math.max(
                          DELIVERABLE_COUNT_MIN,
                          Number(event.target.value) || DEFAULT_HOMEWORK_COUNT,
                        ),
                      ),
                    )
                  }
                  className="w-16 rounded-[var(--rounded-xs)] border border-[var(--border-control)] bg-[var(--bg-canvas)] px-2 py-1.5 text-right font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-primary)] coarse:min-h-[44px]"
                />
              </label>
            ) : null}
          </div>
        </div>

        <div className="mt-4 hidden lg:block">
          <Button
            className="w-full"
            disabled={generatingMaterials || !anyDeliverableChecked}
            aria-busy={generatingMaterials}
            onClick={onGenerateMaterials}
          >
            <SparklesIcon />
            {materialsLabel}
          </Button>
        </div>
      </aside>
    </div>

      <div
        aria-hidden={fieldFocused}
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-150 ease-out motion-reduce:transition-none lg:hidden ${
          fieldFocused ? "pointer-events-none translate-y-full" : ""
        }`}
      >
        <p className="mb-2 truncate font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
          {totalPlannedMinutes} min planned
          {!anyDeliverableChecked ? " · pick at least one material" : ""}
        </p>
        <Button
          className="w-full"
          disabled={generatingMaterials || !anyDeliverableChecked}
          aria-busy={generatingMaterials}
          onClick={onGenerateMaterials}
        >
          <SparklesIcon />
          {materialsLabel}
        </Button>
      </div>
    </div>
  );
};
