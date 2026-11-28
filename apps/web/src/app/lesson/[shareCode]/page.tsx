"use client";

import { ThemeShell, buttonClasses } from "@oku/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { LessonSlidesPanel } from "@/components/lessons/lesson-slides-panel";
import type { LessonWorkspace } from "@/lib/lesson-studio";

type PublicTab = "slides" | "plan";

const PublicLessonPage = (): ReactElement => {
  const params = useParams<{ shareCode: string }>();
  const shareCode = params.shareCode;
  const [lesson, setLesson] = useState<LessonWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PublicTab>("slides");
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/lessons/share/${encodeURIComponent(shareCode)}?view=public`,
        );
        const data = (await res.json()) as {
          lesson?: LessonWorkspace;
          error?: string;
        };
        if (!alive) return;
        if (!res.ok || !data.lesson) {
          setLesson(null);
          setError(data.error ?? "Lesson not found");
          return;
        }
        setLesson(data.lesson);
        if ((data.lesson.slides ?? []).length === 0) {
          setTab("plan");
        }
      } catch {
        if (alive) {
          setLesson(null);
          setError("Could not load this lesson");
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [shareCode]);

  if (loading) {
    return (
      <ThemeShell title="Lesson">
        <p className="text-sm text-[var(--text-secondary)]">Loading lesson…</p>
      </ThemeShell>
    );
  }

  if (error || !lesson) {
    return (
      <ThemeShell title="Lesson">
        <div className="mx-auto max-w-lg rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8">
          <h1 className="text-2xl font-bold tracking-[-0.02em]">
            Lesson not found
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            This lesson is private, still a draft, or the link is incorrect.
          </p>
        </div>
      </ThemeShell>
    );
  }

  const slides = lesson.slides ?? [];
  const planBlocks = lesson.planBlocks ?? [];

  return (
    <ThemeShell title={lesson.title}>
      <header className="border-b border-[var(--border-hairline)] pb-5">
        <p className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
          {lesson.bookTitle} · {lesson.unitTitle} · {lesson.audience}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em]">
          {lesson.title}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {lesson.questions.length > 0 ? (
            <Link
              href={`/play/${lesson.shareCode}`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Take the quiz
            </Link>
          ) : null}
          {lesson.homework.length > 0 ? (
            <Link
              href={`/play/${lesson.shareCode}/homework`}
              className={buttonClasses({ variant: "ghost", size: "sm" })}
            >
              Homework
            </Link>
          ) : null}
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Lesson materials"
        className="mt-5 flex gap-2 border-b border-[var(--border-hairline)] pb-3"
      >
        {slides.length > 0 ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "slides"}
            onClick={() => setTab("slides")}
            className={`min-h-11 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold ${
              tab === "slides"
                ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
            }`}
          >
            Slides
          </button>
        ) : null}
        <button
          type="button"
          role="tab"
          aria-selected={tab === "plan"}
          onClick={() => setTab("plan")}
          className={`min-h-11 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold ${
            tab === "plan"
              ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
              : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
          }`}
        >
          Plan
        </button>
      </div>

      <div className="mt-6">
        {tab === "slides" && slides.length > 0 ? (
          <LessonSlidesPanel
            slides={slides}
            shareCode={lesson.shareCode}
            readOnly
            selectedIndex={slideIndex}
            onSelectedIndexChange={setSlideIndex}
            onChangeSlides={() => undefined}
            onStartTeaching={() => {
              /* Public viewers browse slides only. */
            }}
          />
        ) : null}

        {tab === "plan" ? (
          <ol className="divide-y divide-[var(--border-hairline)] rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
            {planBlocks.length === 0 ? (
              <li className="p-5 text-sm text-[var(--text-secondary)]">
                No plan blocks in this lesson.
              </li>
            ) : (
              planBlocks.map((block, idx) => (
                <li key={block.id} className="p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold">
                      {idx + 1}. {block.title}
                    </h2>
                    <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                      {block.minutes} min
                    </span>
                  </div>
                  <p className="mt-2 max-w-[65ch] text-sm leading-6">
                    {block.explanation}
                  </p>
                  {block.teacherNote.trim() ? (
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--text-primary)]">
                        Classroom cue:{" "}
                      </span>
                      {block.teacherNote}
                    </p>
                  ) : null}
                </li>
              ))
            )}
          </ol>
        ) : null}
      </div>
    </ThemeShell>
  );
};

export default PublicLessonPage;
