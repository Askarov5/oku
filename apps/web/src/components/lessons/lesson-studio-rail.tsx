"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { PlusIcon } from "@/components/lessons/lesson-icons";
import type {
  StudioWorkflowStage,
  LessonWorkspace,
} from "@/lib/lesson-studio";
import { isStudioOpened } from "@/lib/lesson-studio";

interface LessonStudioRailProps {
  lessons: LessonWorkspace[];
  activeLessonId: string | null;
  currentStage: StudioWorkflowStage;
  canJumpToPlan: boolean;
  canJumpToPreview: boolean;
  canJumpToStudio: boolean;
  teacherName?: string | null;
  onSignOut?: () => void;
  onStartNew: () => void;
  onJumpStage: (stage: StudioWorkflowStage) => void;
  onSelectLesson: (lessonId: string) => void;
}

const ROW =
  "flex min-h-11 w-full items-center gap-2.5 rounded-[var(--rounded-xs)] px-3 py-2 text-left text-sm transition-colors";
const ROW_IDLE =
  "text-[var(--text-on-rail)] hover:bg-[var(--rail-hover)] active:bg-[var(--rail-hover)]";
const ROW_ACTIVE =
  "bg-[var(--accent-primary)] font-semibold text-[var(--on-accent)]";
const ROW_DISABLED =
  "cursor-not-allowed text-[var(--text-on-rail-muted)] opacity-55";

const lessonRailHint = (lesson: LessonWorkspace): string => {
  const hasMaterials =
    lesson.slides.length > 0 ||
    lesson.questions.length > 0 ||
    lesson.homework.length > 0;
  if (lesson.stage === "review_plan" || lesson.stage === "generating_plan") {
    return "Plan draft";
  }
  if (lesson.stage === "generating_materials") {
    return "Building materials";
  }
  if (hasMaterials && !isStudioOpened(lesson.id)) {
    return "Preview ready";
  }
  if (hasMaterials) {
    return `${lesson.slides.length} slides · ${lesson.questions.length} Qs`;
  }
  return "Plan draft";
};

export const LessonStudioRail = ({
  lessons,
  activeLessonId,
  currentStage,
  canJumpToPlan,
  canJumpToPreview,
  canJumpToStudio,
  teacherName,
  onSignOut,
  onStartNew,
  onJumpStage,
  onSelectLesson,
}: LessonStudioRailProps): ReactElement => (
  <nav aria-label="Lesson Studio" className="flex flex-col">
    {teacherName ? (
      <div className="mb-3 px-3">
        <p className="text-sm font-semibold text-[var(--text-on-rail)]">
          {teacherName}
        </p>
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            className="-mx-3 mt-0.5 inline-flex min-h-11 items-center px-3 text-sm font-medium text-[var(--text-on-rail-muted)] underline-offset-2 hover:underline"
          >
            Sign out
          </button>
        ) : null}
      </div>
    ) : null}
    <button
      type="button"
      onClick={onStartNew}
      className={`${ROW} ${currentStage === "setup" ? ROW_ACTIVE : ROW_IDLE}`}
    >
      <PlusIcon className="size-4" />
      <span>New lesson</span>
    </button>

    <div className="mt-4 border-t border-[var(--rail-hover)] pt-4">
      <p className="px-3 pb-1.5 text-xs font-medium text-[var(--text-on-rail-muted)]">
        Workflow stages
      </p>
      <ol className="flex flex-col gap-1">
        <li>
          <button
            type="button"
            onClick={() => onJumpStage("setup")}
            className={`${ROW} ${currentStage === "setup" ? ROW_ACTIVE : ROW_IDLE}`}
          >
            <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums">
              1.
            </span>
            <span>Setup &amp; unit</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            disabled={!canJumpToPlan}
            onClick={() => onJumpStage("review_plan")}
            className={`${ROW} ${
              !canJumpToPlan
                ? ROW_DISABLED
                : currentStage === "review_plan"
                  ? ROW_ACTIVE
                  : ROW_IDLE
            }`}
          >
            <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums">
              2.
            </span>
            <span>Plan review</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            disabled={!canJumpToPreview}
            onClick={() => onJumpStage("preview")}
            className={`${ROW} ${
              !canJumpToPreview
                ? ROW_DISABLED
                : currentStage === "preview"
                  ? ROW_ACTIVE
                  : ROW_IDLE
            }`}
          >
            <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums">
              3.
            </span>
            <span>Preview</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            disabled={!canJumpToStudio}
            onClick={() => onJumpStage("studio")}
            className={`${ROW} ${
              !canJumpToStudio
                ? ROW_DISABLED
                : currentStage === "studio"
                  ? ROW_ACTIVE
                  : ROW_IDLE
            }`}
          >
            <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums">
              4.
            </span>
            <span>Teaching studio</span>
          </button>
        </li>
      </ol>
    </div>

    <div className="mt-4 border-t border-[var(--rail-hover)] pt-4">
      <p className="px-3 pb-1.5 text-xs font-medium text-[var(--text-on-rail-muted)]">
        Saved lessons
      </p>
      {lessons.length === 0 ? (
        <p className="px-3 py-2 text-sm text-[var(--text-on-rail-muted)]">
          No saved lessons yet. Start with a textbook unit.
        </p>
      ) : null}
      <ol className="flex flex-col gap-1">
        {lessons.map((lesson) => {
          const active = lesson.id === activeLessonId && currentStage !== "setup";
          return (
            <li key={lesson.id}>
              <button
                type="button"
                onClick={() => onSelectLesson(lesson.id)}
                className={`${ROW} ${active ? ROW_ACTIVE : ROW_IDLE} flex-col items-start gap-1`}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="line-clamp-2 leading-snug">
                    {lesson.title}
                  </span>
                  {lesson.isSample ? (
                    <span
                      className={`shrink-0 rounded-[var(--rounded-xs)] border px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs ${
                        active
                          ? "border-current"
                          : "border-[var(--rail-line)] text-[var(--text-on-rail-muted)]"
                      }`}
                    >
                      Sample
                    </span>
                  ) : null}
                </span>
                <span
                  className={`font-[family-name:var(--font-mono)] text-xs tabular-nums ${
                    active ? "" : "text-[var(--text-on-rail-muted)]"
                  }`}
                >
                  {lesson.amountOfLessons === 1
                    ? `${lesson.minutesPerLesson} min`
                    : `${lesson.amountOfLessons} × ${lesson.minutesPerLesson}m`}
                  {" · "}
                  {lessonRailHint(lesson)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>

    <div className="mt-6 border-t border-[var(--rail-hover)] pt-4">
      <Link href="/admin/library" className={`${ROW} ${ROW_IDLE}`}>
        Digital Library
      </Link>
    </div>
  </nav>
);
