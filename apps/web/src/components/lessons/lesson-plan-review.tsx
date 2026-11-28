"use client";

import { Button, ChevronLeftIcon, RefreshIcon, fieldClass } from "@oku/ui";
import type { ReactElement } from "react";
import { useState } from "react";
import { SparklesIcon } from "@/components/lessons/lesson-icons";
import type {
  LessonDeliverableFlags,
  LessonPlanBlock,
  LessonWorkspace,
} from "@/lib/lesson-studio";

interface LessonPlanReviewProps {
  workspace: LessonWorkspace;
  generatingMaterials: boolean;
  onBackToSetup: () => void;
  onUpdatePlanBlock: (blockId: string, patch: Partial<LessonPlanBlock>) => void;
  onToggleDeliverable: (key: keyof LessonDeliverableFlags) => void;
  onGenerateMaterials: () => void;
}

export const LessonPlanReview = ({
  workspace,
  generatingMaterials,
  onBackToSetup,
  onUpdatePlanBlock,
  onToggleDeliverable,
  onGenerateMaterials,
}: LessonPlanReviewProps): ReactElement => {
  const [activeLessonTab, setActiveLessonTab] = useState(1);
  const [refiningId, setRefiningId] = useState<string | null>(null);

  const lessonNumbers = Array.from(
    new Set(workspace.planBlocks.map((block) => block.lessonNumber)),
  ).sort((a, b) => a - b);

  const visibleBlocks = workspace.planBlocks.filter(
    (block) => block.lessonNumber === activeLessonTab,
  );

  const totalPlannedMinutes = visibleBlocks.reduce(
    (sum, block) => sum + block.minutes,
    0,
  );

  const anyDeliverableChecked =
    workspace.deliverables.slides ||
    workspace.deliverables.kahootTest ||
    workspace.deliverables.homework;

  const quickSimplerRewrite = (block: LessonPlanBlock): void => {
    setRefiningId(block.id);
    window.setTimeout(() => {
      onUpdatePlanBlock(block.id, {
        explanation: `${block.explanation} Concrete check: ask one student to state the rule in everyday words before writing the formula.`,
      });
      setRefiningId(null);
    }, 280);
  };

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="review-plan-heading">
        <button
          type="button"
          onClick={onBackToSetup}
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-ink)] coarse:min-h-[44px]"
        >
          <ChevronLeftIcon />
          Edit unit &amp; angle
        </button>

        <h2
          id="review-plan-heading"
          className="mt-2 text-2xl font-bold tracking-[-0.02em]"
        >
          Review lesson plan before generating materials
        </h2>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
          {workspace.unitTitle} · {workspace.pageRangeLabel} ·{" "}
          {workspace.audience} · {totalPlannedMinutes} min planned
        </p>

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
            className="mt-5 flex flex-wrap gap-2 border-b border-[var(--border-hairline)] pb-3"
          >
            {lessonNumbers.map((num) => {
              const selected = num === activeLessonTab;
              return (
                <button
                  key={num}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => setActiveLessonTab(num)}
                  className={`rounded-[var(--rounded-xs)] border px-3 py-1.5 text-sm font-semibold transition-colors coarse:min-h-[44px] ${
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
            const prevPage = idx > 0 ? visibleBlocks[idx - 1]?.pageRef : null;
            const showPageRule =
              Boolean(block.pageRef) && idx > 0 && block.pageRef !== prevPage;
            const lineEstimate = Math.max(
              4,
              Math.ceil(block.explanation.length / 64),
            );
            return (
              <li
                key={block.id}
                className={
                  idx > 0 && !showPageRule
                    ? "border-t border-[var(--border-hairline)] p-5"
                    : "p-5"
                }
              >
                {showPageRule ? (
                  <div
                    aria-hidden
                    className="-mx-5 -mt-5 mb-5 flex items-center gap-3 px-5"
                  >
                    <span className="h-px flex-1 bg-[var(--border-hairline)]" />
                    <span className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                      {block.pageRef}
                    </span>
                    <span className="h-px flex-1 bg-[var(--border-hairline)]" />
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="font-[family-name:var(--font-mono)] text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      aria-label={`Section ${idx + 1} title`}
                      value={block.title}
                      onChange={(event) =>
                        onUpdatePlanBlock(block.id, { title: event.target.value })
                      }
                      className={`${fieldClass} font-semibold`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                      <input
                        type="number"
                        min={1}
                        max={90}
                        aria-label={`Minutes for section ${idx + 1}`}
                        value={block.minutes}
                        onChange={(event) =>
                          onUpdatePlanBlock(block.id, {
                            minutes: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                        className="w-16 rounded-[var(--rounded-xs)] border border-[var(--border-control)] bg-[var(--bg-canvas)] px-2 py-1.5 text-right font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-primary)] coarse:min-h-[44px]"
                      />
                      <span>min</span>
                    </label>

                    {block.pageRef ? (
                      <span className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                        {block.pageRef}
                      </span>
                    ) : null}
                  </div>
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

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">
                      Classroom cue:{" "}
                    </span>
                    {block.teacherNote}
                  </p>
                  <div className="shrink-0 self-end sm:self-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={refiningId === block.id}
                      onClick={() => quickSimplerRewrite(block)}
                    >
                      <RefreshIcon />
                      {refiningId === block.id
                        ? "Refining…"
                        : "Add check question"}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Approve & Generate Checked Teaching Materials */}
      <aside
        aria-labelledby="approve-materials-heading"
        className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 lg:sticky lg:top-6"
      >
        <h3 id="approve-materials-heading" className="text-lg font-semibold">
          Generate teaching materials
        </h3>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
          Every checked item below will be built directly from your reviewed
          plan and analogy above.
        </p>

        <div className="mt-4 flex flex-col gap-3 border-y border-[var(--border-hairline)] py-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={workspace.deliverables.slides}
              onChange={() => onToggleDeliverable("slides")}
              className="size-4 rounded-[var(--rounded-xs)]"
            />
            Slides &amp; classroom visuals
          </label>

          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={workspace.deliverables.kahootTest}
              onChange={() => onToggleDeliverable("kahootTest")}
              className="size-4 rounded-[var(--rounded-xs)]"
            />
            Kahoot-style test (shareable &amp; auto-graded)
          </label>

          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={workspace.deliverables.homework}
              onChange={() => onToggleDeliverable("homework")}
              className="size-4 rounded-[var(--rounded-xs)]"
            />
            Homework practice &amp; key
          </label>
        </div>

        <Button
          className="mt-4 w-full"
          disabled={generatingMaterials || !anyDeliverableChecked}
          aria-busy={generatingMaterials}
          onClick={onGenerateMaterials}
        >
          <SparklesIcon />
          {generatingMaterials
            ? "Building slides & quiz…"
            : "Approve & generate materials"}
        </Button>
      </aside>
    </div>
  );
};
