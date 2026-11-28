"use client";

import { Button, ThemeShell, buttonClasses } from "@oku/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { KeyboardEvent, ReactElement } from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  AccountAuthForm,
  type AuthUser,
} from "@/components/lessons/account-auth-form";
import { LessonHomeworkPanel } from "@/components/lessons/lesson-homework-panel";
import {
  DocumentIcon,
  ExternalLinkIcon,
  PlayIcon,
  SlidesIcon,
  TrophyIcon,
} from "@/components/lessons/lesson-icons";
import { LessonKahootPanel } from "@/components/lessons/lesson-kahoot-panel";
import { LessonPlanReview } from "@/components/lessons/lesson-plan-review";
import { LessonSetupView } from "@/components/lessons/lesson-setup-view";
import { LessonSlidesPanel } from "@/components/lessons/lesson-slides-panel";
import { LessonStudioRail } from "@/components/lessons/lesson-studio-rail";
import { TeachPresenterModal } from "@/components/lessons/teach-presenter-modal";
import type {
  LessonDeliverableFlags,
  LessonPlanBlock,
  LessonSetupDraft,
  LessonWorkspace,
  StudioBookOption,
} from "@/lib/lesson-studio";
import {
  SAMPLE_STUDIO_BOOKS,
  defaultAudienceForBook,
} from "@/lib/lesson-studio";

type StudioTab = "slides" | "plan" | "kahoot" | "homework";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const initialSetupForBooks = (
  books: StudioBookOption[],
  bookIdParam: string | null,
  unitParam: string | null,
): LessonSetupDraft => {
  const matchedBook =
    (bookIdParam ? books.find((b) => b.id === bookIdParam) : null) ?? books[0]!;
  const parsedUnit = unitParam ? Math.max(0, Number(unitParam) - 1) : 0;
  const safeUnit = parsedUnit < matchedBook.units.length ? parsedUnit : 0;

  return {
    bookId: matchedBook.id,
    unitIndex: safeUnit,
    audience: defaultAudienceForBook(matchedBook),
    audienceTouched: false,
    amountOfLessons: 1,
    minutesPerLesson: 45,
    creativeAngle: "",
    deliverables: {
      slides: true,
      kahootTest: true,
      homework: true,
    },
    attachments: [],
  };
};

const LessonStudioContent = (): ReactElement => {
  const searchParams = useSearchParams();
  const bookIdParam = searchParams.get("bookId");
  const unitParam = searchParams.get("unit");
  const lessonParam = searchParams.get("lesson");

  const [teacher, setTeacher] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [books, setBooks] = useState<StudioBookOption[]>(SAMPLE_STUDIO_BOOKS);
  const [lessons, setLessons] = useState<LessonWorkspace[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [setupDraft, setSetupDraft] = useState<LessonSetupDraft>(() =>
    initialSetupForBooks(SAMPLE_STUDIO_BOOKS, bookIdParam, unitParam),
  );
  const [studioTab, setStudioTab] = useState<StudioTab>("slides");
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatingMaterials, setGeneratingMaterials] = useState(false);
  const [presenterOpen, setPresenterOpen] = useState(false);
  const [presenterStart, setPresenterStart] = useState(0);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);
  const patchTimers = useRef<Map<string, number>>(new Map());

  const refreshLessons = useCallback(async (): Promise<LessonWorkspace[]> => {
    const res = await fetch("/api/lessons");
    if (!res.ok) return [];
    const data = (await res.json()) as { lessons?: LessonWorkspace[] };
    const items = Array.isArray(data.lessons) ? data.lessons : [];
    setLessons(items);
    return items;
  }, []);

  useEffect(() => {
    let alive = true;
    const boot = async (): Promise<void> => {
      try {
        const res = await fetch("/api/auth/me");
        if (!alive) return;
        if (!res.ok) {
          setTeacher(null);
          return;
        }
        const data = (await res.json()) as { user?: AuthUser };
        if (data.user?.role === "teacher") {
          setTeacher(data.user);
        } else {
          setTeacher(null);
        }
      } catch {
        if (alive) setTeacher(null);
      } finally {
        if (alive) setAuthChecked(true);
      }
    };
    void boot();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!teacher) return;
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const items = await refreshLessons();
        if (!alive) return;
        if (lessonParam) {
          const match = items.find((item) => item.id === lessonParam);
          if (match) setActiveLessonId(match.id);
        }
      } catch {
        // Keep empty list when API is down.
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [teacher, lessonParam, refreshLessons]);

  useEffect(() => {
    let active = true;
    const loadCatalog = async (): Promise<void> => {
      try {
        const res = await fetch("/api/lessons/catalog");
        if (!res.ok || !active) return;
        const data = (await res.json()) as { books?: StudioBookOption[] };
        if (!active || !Array.isArray(data.books) || data.books.length === 0) {
          return;
        }
        setBooks(data.books);
        if (bookIdParam) {
          setSetupDraft(initialSetupForBooks(data.books, bookIdParam, unitParam));
        }
      } catch {
        // Keep sample catalog when offline.
      }
    };
    void loadCatalog();
    return () => {
      active = false;
    };
  }, [bookIdParam, unitParam]);

  const activeWorkspace =
    lessons.find((item) => item.id === activeLessonId) ?? null;

  const upsertLesson = (lesson: LessonWorkspace): void => {
    setLessons((prev) => {
      const without = prev.filter((item) => item.id !== lesson.id);
      return [lesson, ...without];
    });
  };

  const pollLessonUntil = async (
    lessonId: string,
    done: (lesson: LessonWorkspace) => boolean,
  ): Promise<LessonWorkspace | null> => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await sleep(attempt === 0 ? 600 : 1500);
      const res = await fetch(`/api/lessons/${lessonId}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { lesson?: LessonWorkspace };
      if (!data.lesson) continue;
      upsertLesson(data.lesson);
      if (done(data.lesson)) return data.lesson;
      if (data.lesson.dbStage === "failed" || data.lesson.stage === "failed") {
        setStudioNotice(data.lesson.jobError ?? "Generation failed");
        return data.lesson;
      }
    }
    setStudioNotice("Timed out waiting for generation. Refresh and try again.");
    return null;
  };

  const handleGeneratePlan = (): void => {
    const book = books.find((item) => item.id === setupDraft.bookId) ?? books[0];
    const unit = book?.units[setupDraft.unitIndex] ?? book?.units[0];
    if (!book || !unit) {
      setStudioNotice("Choose a book and a unit before generating a lesson plan.");
      return;
    }

    setStudioNotice(null);
    setGeneratingPlan(true);
    void (async () => {
      try {
        const res = await fetch("/api/lessons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: book.id,
            unitId: unit.id,
            unitIndex: setupDraft.unitIndex,
            audience: setupDraft.audience.trim() || defaultAudienceForBook(book),
            amountOfLessons: setupDraft.amountOfLessons,
            minutesPerLesson: setupDraft.minutesPerLesson,
            creativeAngle: setupDraft.creativeAngle,
            deliverables: setupDraft.deliverables,
            attachments: setupDraft.attachments,
          }),
        });
        const data = (await res.json()) as {
          lesson?: LessonWorkspace;
          error?: string;
        };
        if (!res.ok || !data.lesson) {
          setStudioNotice(data.error ?? "Could not start plan generation");
          return;
        }
        upsertLesson(data.lesson);
        setActiveLessonId(data.lesson.id);
        const finished = await pollLessonUntil(
          data.lesson.id,
          (lesson) =>
            lesson.stage === "review_plan" || lesson.dbStage === "review_plan",
        );
        if (finished?.jobError) {
          setStudioNotice(finished.jobError);
        }
      } catch {
        setStudioNotice("Network error while generating the plan");
      } finally {
        setGeneratingPlan(false);
      }
    })();
  };

  const handleGenerateMaterials = (): void => {
    if (!activeWorkspace || activeWorkspace.isSample) return;
    setGeneratingMaterials(true);
    setStudioNotice(null);
    void (async () => {
      try {
        // Persist plan edits before enqueueing materials.
        await fetch(`/api/lessons/${activeWorkspace.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planBlocks: activeWorkspace.planBlocks,
            deliverables: activeWorkspace.deliverables,
          }),
        });
        const res = await fetch(`/api/lessons/${activeWorkspace.id}/materials`, {
          method: "POST",
        });
        const data = (await res.json()) as {
          lesson?: LessonWorkspace;
          error?: string;
        };
        if (!res.ok || !data.lesson) {
          setStudioNotice(data.error ?? "Could not start materials generation");
          return;
        }
        upsertLesson(data.lesson);
        const finished = await pollLessonUntil(
          activeWorkspace.id,
          (lesson) => lesson.stage === "studio" || lesson.dbStage === "studio",
        );
        if (finished) {
          if (finished.deliverables.slides && finished.slides.length > 0) {
            setStudioTab("slides");
          } else if (finished.deliverables.kahootTest) {
            setStudioTab("kahoot");
          } else if (finished.deliverables.homework) {
            setStudioTab("homework");
          } else {
            setStudioTab("plan");
          }
          if (finished.jobError) setStudioNotice(finished.jobError);
        }
      } catch {
        setStudioNotice("Network error while building materials");
      } finally {
        setGeneratingMaterials(false);
      }
    })();
  };

  const patchWorkspaceRemote = (
    lessonId: string,
    patch: Partial<LessonWorkspace>,
  ): void => {
    setLessons((prev) =>
      prev.map((item) =>
        item.id === lessonId
          ? { ...item, ...patch, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
    const existing = patchTimers.current.get(lessonId);
    if (existing) window.clearTimeout(existing);
    const handle = window.setTimeout(() => {
      patchTimers.current.delete(lessonId);
      void fetch(`/api/lessons/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: patch.title,
          planBlocks: patch.planBlocks,
          slides: patch.slides,
          homework: patch.homework,
          deliverables: patch.deliverables,
          questions: patch.questions,
          creativeAngle: patch.creativeAngle,
          audience: patch.audience,
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setStudioNotice(data.error ?? "Could not save edits");
          return;
        }
        const data = (await res.json()) as { lesson?: LessonWorkspace };
        if (data.lesson) upsertLesson(data.lesson);
      });
    }, 500);
    patchTimers.current.set(lessonId, handle);
  };

  const updatePlanBlock = (
    blockId: string,
    patch: Partial<LessonPlanBlock>,
  ): void => {
    if (!activeWorkspace || activeWorkspace.isSample) return;
    const planBlocks = activeWorkspace.planBlocks.map((block) =>
      block.id === blockId ? { ...block, ...patch } : block,
    );
    patchWorkspaceRemote(activeWorkspace.id, { planBlocks });
  };

  const toggleWorkspaceDeliverable = (
    key: keyof LessonDeliverableFlags,
  ): void => {
    if (!activeWorkspace || activeWorkspace.isSample) return;
    const deliverables = {
      ...activeWorkspace.deliverables,
      [key]: !activeWorkspace.deliverables[key],
    };
    patchWorkspaceRemote(activeWorkspace.id, { deliverables });
  };

  const openPresenter = (startAt = 0): void => {
    setPresenterStart(startAt);
    setPresenterOpen(true);
  };

  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.questions.length === 0) {
      return undefined;
    }
    let alive = true;
    const syncRemoteQuiz = async (): Promise<void> => {
      try {
        const res = await fetch(
          `/api/lessons/share/${encodeURIComponent(activeWorkspace.shareCode)}`,
        );
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { lesson?: LessonWorkspace };
        if (!alive || !data.lesson) return;
        setLessons((prev) =>
          prev.map((item) =>
            item.id === activeWorkspace.id
              ? { ...item, leaderboard: data.lesson!.leaderboard }
              : item,
          ),
        );
      } catch {
        // Ignore offline errors.
      }
    };
    void syncRemoteQuiz();
    const timer = window.setInterval(() => {
      void syncRemoteQuiz();
    }, 4000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [
    activeWorkspace?.id,
    activeWorkspace?.shareCode,
    activeWorkspace?.questions.length,
  ]);

  const currentStage: "setup" | "review_plan" | "studio" = !activeWorkspace
    ? "setup"
    : activeWorkspace.stage === "generating_plan"
      ? "setup"
      : activeWorkspace.stage === "generating_materials"
        ? "review_plan"
        : activeWorkspace.stage === "failed"
          ? activeWorkspace.planBlocks.length > 0
            ? "review_plan"
            : "setup"
          : activeWorkspace.stage === "review_plan"
            ? "review_plan"
            : "studio";

  const hasStudioMaterials = Boolean(
    activeWorkspace &&
      (activeWorkspace.slides.length > 0 ||
        activeWorkspace.questions.length > 0 ||
        activeWorkspace.homework.length > 0),
  );

  const handleJumpStage = (target: "setup" | "review_plan" | "studio"): void => {
    if (target === "setup") {
      if (activeWorkspace) {
        setSetupDraft({
          bookId: activeWorkspace.bookId,
          unitIndex: activeWorkspace.unitIndex,
          audience: activeWorkspace.audience,
          audienceTouched: true,
          amountOfLessons: activeWorkspace.amountOfLessons,
          minutesPerLesson: activeWorkspace.minutesPerLesson,
          creativeAngle: activeWorkspace.creativeAngle,
          deliverables: activeWorkspace.deliverables,
          attachments: activeWorkspace.attachments,
        });
      }
      setActiveLessonId(null);
      return;
    }
    if (!activeWorkspace) return;
    if (target === "studio" && !hasStudioMaterials) return;
    setActiveLessonId(activeWorkspace.id);
  };

  const handleSignOut = async (): Promise<void> => {
    await fetch("/api/auth/logout", { method: "POST" });
    setTeacher(null);
    setLessons([]);
    setActiveLessonId(null);
  };

  const rail = (
    <LessonStudioRail
      lessons={lessons}
      activeLessonId={activeLessonId}
      currentStage={currentStage}
      canJumpToPlan={Boolean(activeWorkspace)}
      canJumpToStudio={hasStudioMaterials}
      teacherName={teacher?.displayName ?? null}
      onSignOut={() => {
        void handleSignOut();
      }}
      onStartNew={() => setActiveLessonId(null)}
      onJumpStage={handleJumpStage}
      onSelectLesson={(id) => {
        setActiveLessonId(id);
        setStudioTab("slides");
      }}
    />
  );

  if (!authChecked) {
    return (
      <ThemeShell title="Lesson Studio" rail={rail}>
        <p className="text-sm text-[var(--text-secondary)]">Checking account…</p>
      </ThemeShell>
    );
  }

  if (!teacher) {
    return (
      <ThemeShell title="Lesson Studio" rail={rail}>
        <AccountAuthForm
          role="teacher"
          title="Teacher sign-in"
          subtitle="Create a light teacher account to generate and keep lessons. Students use a separate student account on the quiz page."
          onAuthenticated={setTeacher}
        />
      </ThemeShell>
    );
  }

  const showSetup =
    !activeWorkspace ||
    activeWorkspace.stage === "generating_plan" ||
    (activeWorkspace.stage === "failed" && activeWorkspace.planBlocks.length === 0);

  const showPlanReview =
    activeWorkspace &&
    (activeWorkspace.stage === "review_plan" ||
      activeWorkspace.stage === "generating_materials" ||
      (activeWorkspace.stage === "failed" &&
        activeWorkspace.planBlocks.length > 0 &&
        !hasStudioMaterials));

  return (
    <ThemeShell title="Lesson Studio" rail={rail}>
      <p role="status" className="sr-only">
        {generatingPlan
          ? "Generating the lesson plan."
          : generatingMaterials
            ? "Building slides, quiz, and homework."
            : studioNotice ?? ""}
      </p>
      {studioNotice ? (
        <p className="mb-4 text-sm font-medium text-[var(--status-failed)]">
          {studioNotice}
        </p>
      ) : null}
      {showSetup ? (
        <div key="stage-setup" className="oku-stage-enter">
          <LessonSetupView
            books={books}
            draft={setupDraft}
            generating={generatingPlan || activeWorkspace?.stage === "generating_plan"}
            onChangeDraft={setSetupDraft}
            onGeneratePlan={handleGeneratePlan}
          />
        </div>
      ) : showPlanReview && activeWorkspace ? (
        <div key={`stage-plan-${activeWorkspace.id}`} className="oku-stage-enter">
          <LessonPlanReview
            workspace={activeWorkspace}
            generatingMaterials={
              generatingMaterials ||
              activeWorkspace.stage === "generating_materials"
            }
            onBackToSetup={() => handleJumpStage("setup")}
            onUpdatePlanBlock={updatePlanBlock}
            onToggleDeliverable={toggleWorkspaceDeliverable}
            onGenerateMaterials={handleGenerateMaterials}
          />
        </div>
      ) : activeWorkspace ? (
        <div key={`stage-studio-${activeWorkspace.id}`} className="oku-stage-enter">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="break-words text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
                  {activeWorkspace.title}
                </h2>
                {activeWorkspace.isSample ? (
                  <span className="rounded-[var(--rounded-xs)] border border-[var(--border-control)] bg-[var(--bg-surface)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                    Sample lesson
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                <span>{activeWorkspace.bookTitle}</span>
                <span aria-hidden>·</span>
                <span>{activeWorkspace.pageRangeLabel}</span>
                <span aria-hidden>·</span>
                <span>{activeWorkspace.audience}</span>
                <span aria-hidden>·</span>
                <span>
                  {activeWorkspace.amountOfLessons === 1
                    ? `${activeWorkspace.minutesPerLesson} min`
                    : `${activeWorkspace.amountOfLessons} lessons × ${activeWorkspace.minutesPerLesson} min`}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {activeWorkspace.questions.length > 0 ? (
                <Link
                  href={`/play/${activeWorkspace.shareCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses({ variant: "ghost" })}
                >
                  <ExternalLinkIcon />
                  Student quiz
                  <span className="sr-only">, opens in a new tab</span>
                </Link>
              ) : null}

              {activeWorkspace.slides.length > 0 ? (
                <Button onClick={() => openPresenter(0)}>
                  <PlayIcon />
                  Start teaching
                </Button>
              ) : null}
            </div>
          </header>

          <div
            role="tablist"
            aria-label="Lesson materials"
            className="mt-5 flex flex-wrap gap-2 border-b border-[var(--border-hairline)] pb-3"
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              const order: StudioTab[] = [];
              if (activeWorkspace.slides.length > 0) order.push("slides");
              order.push("plan");
              if (activeWorkspace.questions.length > 0) order.push("kahoot");
              if (activeWorkspace.homework.length > 0) order.push("homework");
              const current = Math.max(0, order.indexOf(studioTab));
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
                return;
              }
              event.preventDefault();
              const delta = event.key === "ArrowRight" ? 1 : -1;
              const next =
                order[(current + delta + order.length) % order.length] ?? "plan";
              setStudioTab(next);
              window.requestAnimationFrame(() => {
                document.getElementById(`studio-tab-${next}`)?.focus();
              });
            }}
          >
            {activeWorkspace.slides.length > 0 ? (
              <button
                id="studio-tab-slides"
                role="tab"
                type="button"
                aria-selected={studioTab === "slides"}
                aria-controls="studio-panel"
                tabIndex={studioTab === "slides" ? 0 : -1}
                onClick={() => setStudioTab("slides")}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  studioTab === "slides"
                    ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <SlidesIcon />
                Slides &amp; uploads ({activeWorkspace.slides.length})
              </button>
            ) : null}

            <button
              id="studio-tab-plan"
              role="tab"
              type="button"
              aria-selected={studioTab === "plan"}
              aria-controls="studio-panel"
              tabIndex={studioTab === "plan" ? 0 : -1}
              onClick={() => setStudioTab("plan")}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors ${
                studioTab === "plan"
                  ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                  : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <DocumentIcon />
              Lesson plan ({activeWorkspace.planBlocks.length})
            </button>

            {activeWorkspace.questions.length > 0 ? (
              <button
                id="studio-tab-kahoot"
                role="tab"
                type="button"
                aria-selected={studioTab === "kahoot"}
                aria-controls="studio-panel"
                tabIndex={studioTab === "kahoot" ? 0 : -1}
                onClick={() => setStudioTab("kahoot")}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  studioTab === "kahoot"
                    ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <TrophyIcon />
                Kahoot test ({activeWorkspace.questions.length} ·{" "}
                {activeWorkspace.leaderboard.length} results)
              </button>
            ) : null}

            {activeWorkspace.homework.length > 0 ? (
              <button
                id="studio-tab-homework"
                role="tab"
                type="button"
                aria-selected={studioTab === "homework"}
                aria-controls="studio-panel"
                tabIndex={studioTab === "homework" ? 0 : -1}
                onClick={() => setStudioTab("homework")}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  studioTab === "homework"
                    ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                Homework ({activeWorkspace.homework.length})
              </button>
            ) : null}
          </div>

          <div
            id="studio-panel"
            role="tabpanel"
            aria-labelledby={`studio-tab-${studioTab}`}
            className="mt-6"
          >
            {studioTab === "slides" && activeWorkspace.slides.length > 0 ? (
              <LessonSlidesPanel
                slides={activeWorkspace.slides}
                shareCode={activeWorkspace.shareCode}
                onChangeSlides={(slides) =>
                  patchWorkspaceRemote(activeWorkspace.id, { slides })
                }
                onStartTeaching={openPresenter}
              />
            ) : null}

            {studioTab === "plan" ? (
              <ol className="divide-y divide-[var(--border-hairline)] rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
                {activeWorkspace.planBlocks.map((block, idx) => (
                  <li key={block.id} className="p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-base font-semibold">
                        {idx + 1}. {block.title}
                      </h3>
                      <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                        {block.minutes} min
                        {block.pageRef ? ` · ${block.pageRef}` : ""}
                      </span>
                    </div>
                    <p className="mt-2 max-w-[65ch] text-sm leading-6">
                      {block.explanation}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--text-primary)]">
                        Classroom cue:{" "}
                      </span>
                      {block.teacherNote}
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}

            {studioTab === "kahoot" && activeWorkspace.questions.length > 0 ? (
              <LessonKahootPanel
                shareCode={activeWorkspace.shareCode}
                questions={activeWorkspace.questions}
                leaderboard={activeWorkspace.leaderboard}
                onChangeQuestions={(questions) =>
                  patchWorkspaceRemote(activeWorkspace.id, { questions })
                }
              />
            ) : null}

            {studioTab === "homework" && activeWorkspace.homework.length > 0 ? (
              <LessonHomeworkPanel
                lessonTitle={activeWorkspace.title}
                homework={activeWorkspace.homework}
                onChangeHomework={(homework) =>
                  patchWorkspaceRemote(activeWorkspace.id, { homework })
                }
              />
            ) : null}
          </div>

          <TeachPresenterModal
            open={presenterOpen}
            lessonTitle={activeWorkspace.title}
            minutesPerLesson={activeWorkspace.minutesPerLesson}
            slides={activeWorkspace.slides}
            initialIndex={presenterStart}
            shareCode={activeWorkspace.shareCode}
            leaderboardCount={activeWorkspace.leaderboard.length}
            onClose={() => setPresenterOpen(false)}
          />
        </div>
      ) : null}
    </ThemeShell>
  );
};

const LessonsPage = (): ReactElement => (
  <Suspense
    fallback={
      <div className="p-8 text-sm text-[var(--text-secondary)]">
        Loading Lesson Studio…
      </div>
    }
  >
    <LessonStudioContent />
  </Suspense>
);

export default LessonsPage;
