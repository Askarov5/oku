"use client";

import { Button, ThemeShell, buttonClasses } from "@oku/ui";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { KeyboardEvent, ReactElement } from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  AccountAuthForm,
  type AuthUser,
} from "@/components/lessons/account-auth-form";
import {
  HoverLabel,
  LessonAccessControls,
} from "@/components/lessons/lesson-access-controls";
import { LessonHomeworkPanel } from "@/components/lessons/lesson-homework-panel";
import { LessonBookPanel } from "@/components/lessons/lesson-book-panel";
import {
  BookOpenIcon,
  DocumentIcon,
  ExternalLinkIcon,
  PlayIcon,
  SlidesIcon,
  TrophyIcon,
} from "@/components/lessons/lesson-icons";
import { LessonKahootPanel } from "@/components/lessons/lesson-kahoot-panel";
import { LessonPlanReview } from "@/components/lessons/lesson-plan-review";
import { LessonPreviewView } from "@/components/lessons/lesson-preview-view";
import { LessonSetupView } from "@/components/lessons/lesson-setup-view";
import { LessonSlidesPanel } from "@/components/lessons/lesson-slides-panel";
import { LessonStudioRail } from "@/components/lessons/lesson-studio-rail";
import { TeachPresenterModal } from "@/components/lessons/teach-presenter-modal";
import type {
  LessonAccess,
  LessonDeliverableFlags,
  LessonPlanBlock,
  LessonSetupDraft,
  LessonWorkspace,
  StudioBookOption,
  StudioTab,
  StudioWorkflowStage,
} from "@/lib/lesson-studio";
import {
  DEFAULT_HOMEWORK_COUNT,
  DEFAULT_QUIZ_COUNT,
  DEFAULT_SLIDE_COUNT,
  SAMPLE_STUDIO_BOOKS,
  clearStudioOpened,
  defaultAudienceForBook,
  isStudioOpened,
  markStudioOpened,
  stageToUrlParam,
  tabToUrlParam,
  urlParamToStage,
  urlParamToTab,
} from "@/lib/lesson-studio";

type StudioSaveSection = "slides" | "questions" | "homework";

interface StudioContentBaseline {
  slides: string;
  questions: string;
  homework: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const snapshotStudioBaseline = (
  lesson: LessonWorkspace,
): StudioContentBaseline => ({
  slides: JSON.stringify(lesson.slides ?? []),
  questions: JSON.stringify(lesson.questions ?? []),
  homework: JSON.stringify(lesson.homework ?? []),
});

const sectionFingerprint = (
  lesson: LessonWorkspace,
  section: StudioSaveSection,
): string => {
  if (section === "slides") return JSON.stringify(lesson.slides ?? []);
  if (section === "questions") return JSON.stringify(lesson.questions ?? []);
  return JSON.stringify(lesson.homework ?? []);
};

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
      slideCount: DEFAULT_SLIDE_COUNT,
      quizCount: DEFAULT_QUIZ_COUNT,
      homeworkCount: DEFAULT_HOMEWORK_COUNT,
    },
    attachments: [],
  };
};

const LessonStudioContent = (): ReactElement => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bookIdParam = searchParams.get("bookId");
  const unitParam = searchParams.get("unit");
  const lessonParam = searchParams.get("lesson");
  const stageParam = searchParams.get("stage");
  const tabParam = searchParams.get("tab");
  const slideParam = searchParams.get("slide");

  const [teacher, setTeacher] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [books, setBooks] = useState<StudioBookOption[]>(SAMPLE_STUDIO_BOOKS);
  const [lessons, setLessons] = useState<LessonWorkspace[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(
    lessonParam,
  );
  const [setupDraft, setSetupDraft] = useState<LessonSetupDraft>(() =>
    initialSetupForBooks(SAMPLE_STUDIO_BOOKS, bookIdParam, unitParam),
  );
  const [studioTab, setStudioTab] = useState<StudioTab>(
    () => urlParamToTab(tabParam) ?? "book",
  );
  const [slideIndex, setSlideIndex] = useState(() => {
    const parsed = slideParam ? Number(slideParam) - 1 : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  });
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatingMaterials, setGeneratingMaterials] = useState(false);
  const [presenterOpen, setPresenterOpen] = useState(false);
  const [presenterStart, setPresenterStart] = useState(0);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);
  const [lessonLoadFailed, setLessonLoadFailed] = useState(false);
  const [workflowOverride, setWorkflowOverride] =
    useState<StudioWorkflowStage | null>(() => urlParamToStage(stageParam));
  const [studioOpenedTick, setStudioOpenedTick] = useState(0);
  const urlHydrated = useRef(false);
  const [savingSection, setSavingSection] = useState<StudioSaveSection | null>(
    null,
  );
  const [savedFlashSection, setSavedFlashSection] =
    useState<StudioSaveSection | null>(null);
  const [baselineVersion, setBaselineVersion] = useState(0);
  const patchTimers = useRef<Map<string, number>>(new Map());
  const studioBaselines = useRef<Map<string, StudioContentBaseline>>(new Map());
  const lessonsRef = useRef<LessonWorkspace[]>([]);
  const savedFlashTimer = useRef<number | null>(null);

  const normalizeWorkspace = useCallback(
    (lesson: LessonWorkspace): LessonWorkspace => ({
      ...lesson,
      access: lesson.access ?? (lesson.isSample ? "public" : "draft"),
      slides: lesson.slides ?? [],
      questions: lesson.questions ?? [],
      homework: lesson.homework ?? [],
      planBlocks: lesson.planBlocks ?? [],
      leaderboard: lesson.leaderboard ?? [],
      homeworkLeaderboard: lesson.homeworkLeaderboard ?? [],
      attachments: lesson.attachments ?? [],
    }),
    [],
  );

  const refreshLessons = useCallback(async (): Promise<LessonWorkspace[]> => {
    let res: Response;
    try {
      res = await fetch("/api/lessons");
    } catch {
      throw new Error(
        "Could not load your lessons. Check the connection and try again.",
      );
    }
    if (res.status === 401) {
      setTeacher(null);
      throw new Error("Sign in again to open this lesson.");
    }
    if (!res.ok) {
      throw new Error("Could not load your lessons. Try again.");
    }
    const data = (await res.json()) as { lessons?: LessonWorkspace[] };
    const items = (Array.isArray(data.lessons) ? data.lessons : []).map(
      (lesson) => normalizeWorkspace(lesson),
    );
    setLessons(items);
    return items;
  }, [normalizeWorkspace, setTeacher]);

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

  const openLessonFromUrl = useCallback(async (): Promise<void> => {
    try {
      const items = await refreshLessons();
      setLessonLoadFailed(false);
      if (!lessonParam) {
        setStudioNotice(null);
        return;
      }
      const match = items.find((item) => item.id === lessonParam);
      if (!match) {
        setActiveLessonId(null);
        setWorkflowOverride(null);
        setStudioNotice(
          "This lesson is no longer available. Start a new one below, or open a saved lesson.",
        );
        return;
      }
      setStudioNotice(null);
      setActiveLessonId(match.id);
      const stageFromUrl = urlParamToStage(stageParam);
      if (stageFromUrl === "studio") {
        markStudioOpened(match.id);
        setStudioOpenedTick((value) => value + 1);
      }
      if (stageFromUrl) {
        setWorkflowOverride(stageFromUrl);
      }
      const tabFromUrl = urlParamToTab(tabParam);
      if (tabFromUrl) setStudioTab(tabFromUrl);
      if (slideParam) {
        const parsed = Number(slideParam) - 1;
        if (Number.isFinite(parsed) && parsed >= 0) {
          setSlideIndex(parsed);
        }
      }
    } catch (error) {
      setLessonLoadFailed(true);
      setStudioNotice(
        error instanceof Error
          ? error.message
          : "Could not load your lessons. Check the connection and try again.",
      );
    }
  }, [lessonParam, refreshLessons, slideParam, stageParam, tabParam]);

  useEffect(() => {
    if (!teacher || urlHydrated.current) return;
    let alive = true;
    const load = async (): Promise<void> => {
      await openLessonFromUrl();
      if (alive) urlHydrated.current = true;
    };
    void load();
    return () => {
      alive = false;
    };
  }, [teacher, openLessonFromUrl]);

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

  lessonsRef.current = lessons;

  const upsertLesson = (lesson: LessonWorkspace): void => {
    const normalized = normalizeWorkspace(lesson);
    setLessons((prev) => {
      const without = prev.filter((item) => item.id !== normalized.id);
      return [normalized, ...without];
    });
  };

  const pollLessonUntil = async (
    lessonId: string,
    done: (lesson: LessonWorkspace) => boolean,
    /** Materials fan out many LLM calls; allow ~10 minutes before soft-timeout. */
    maxAttempts = 90,
  ): Promise<LessonWorkspace | null> => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
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
    setStudioNotice(
      "Still generating in the background. Preview will unlock when materials are ready — you can stay on this page.",
    );
    return null;
  };

  const openPreviewFromLesson = useCallback((_lesson: LessonWorkspace): void => {
    setWorkflowOverride("preview");
    setStudioNotice(null);
    setStudioTab("book");
  }, []);

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
          400,
        );
        if (finished) {
          openPreviewFromLesson(finished);
          if (finished.jobError) setStudioNotice(finished.jobError);
        }
      } catch {
        setStudioNotice("Network error while building materials");
      } finally {
        setGeneratingMaterials(false);
      }
    })();
  };

  /** If the active poll gave up early, keep soft-polling until materials land. */
  useEffect(() => {
    if (!activeWorkspace) return;
    const waiting =
      activeWorkspace.stage === "generating_materials" ||
      activeWorkspace.stage === "generating_plan";
    if (!waiting || generatingMaterials || generatingPlan) return;

    let alive = true;
    const sync = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/lessons/${activeWorkspace.id}`);
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { lesson?: LessonWorkspace };
        if (!alive || !data.lesson) return;
        upsertLesson(data.lesson);
        if (
          data.lesson.stage === "studio" ||
          data.lesson.dbStage === "studio"
        ) {
          openPreviewFromLesson(data.lesson);
          return;
        }
        if (
          data.lesson.stage === "review_plan" ||
          data.lesson.dbStage === "review_plan"
        ) {
          setStudioNotice(null);
          setWorkflowOverride("review_plan");
        }
        if (data.lesson.stage === "failed" || data.lesson.dbStage === "failed") {
          setStudioNotice(data.lesson.jobError ?? "Generation failed");
        }
      } catch {
        // Ignore offline blips; interval retries.
      }
    };

    void sync();
    const timer = window.setInterval(() => {
      void sync();
    }, 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [
    activeWorkspace?.id,
    activeWorkspace?.stage,
    generatingMaterials,
    generatingPlan,
    openPreviewFromLesson,
  ]);

  const patchWorkspace = (
    lessonId: string,
    patch: Partial<LessonWorkspace>,
  ): void => {
    setLessons((prev) =>
      prev.map((item) => {
        if (item.id !== lessonId) return item;
        const next = normalizeWorkspace({
          ...item,
          ...patch,
          updatedAt: new Date().toISOString(),
        });
        // Partial patches must not clobber arrays with undefined.
        if (patch.slides === undefined) next.slides = item.slides ?? [];
        if (patch.questions === undefined) next.questions = item.questions ?? [];
        if (patch.homework === undefined) next.homework = item.homework ?? [];
        if (patch.planBlocks === undefined) {
          next.planBlocks = item.planBlocks ?? [];
        }
        return next;
      }),
    );
  };

  /** Debounced remote save for plan-review edits (title, plan blocks, deliverables). */
  const patchWorkspaceRemote = (
    lessonId: string,
    patch: Partial<LessonWorkspace>,
  ): void => {
    patchWorkspace(lessonId, patch);
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

  const saveWorkspaceSection = async (
    lessonId: string,
    section: StudioSaveSection,
  ): Promise<void> => {
    const lesson = lessonsRef.current.find((item) => item.id === lessonId);
    if (!lesson || lesson.isSample) return;

    const fingerprint = sectionFingerprint(lesson, section);
    const body =
      section === "slides"
        ? { slides: lesson.slides }
        : section === "questions"
          ? { questions: lesson.questions }
          : { homework: lesson.homework };

    setSavingSection(section);
    setStudioNotice(null);
    if (savedFlashTimer.current) {
      window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = null;
    }
    setSavedFlashSection(null);

    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStudioNotice(data.error ?? "Could not save edits");
        return;
      }
      const data = (await res.json()) as { lesson?: LessonWorkspace };
      const current = lessonsRef.current.find((item) => item.id === lessonId);
      if (
        current &&
        sectionFingerprint(current, section) !== fingerprint
      ) {
        // Teacher kept editing while the request was in flight; leave dirty.
        return;
      }

      if (data.lesson) {
        upsertLesson(data.lesson);
        const previous = studioBaselines.current.get(lessonId);
        const fromServer = snapshotStudioBaseline(
          normalizeWorkspace(data.lesson),
        );
        studioBaselines.current.set(lessonId, {
          slides:
            section === "slides"
              ? fromServer.slides
              : (previous?.slides ?? fromServer.slides),
          questions:
            section === "questions"
              ? fromServer.questions
              : (previous?.questions ?? fromServer.questions),
          homework:
            section === "homework"
              ? fromServer.homework
              : (previous?.homework ?? fromServer.homework),
        });
      } else {
        const previous = studioBaselines.current.get(lessonId);
        studioBaselines.current.set(lessonId, {
          slides:
            section === "slides"
              ? fingerprint
              : (previous?.slides ?? fingerprint),
          questions:
            section === "questions"
              ? fingerprint
              : (previous?.questions ?? fingerprint),
          homework:
            section === "homework"
              ? fingerprint
              : (previous?.homework ?? fingerprint),
        });
      }
      setBaselineVersion((value) => value + 1);
      setSavedFlashSection(section);
      savedFlashTimer.current = window.setTimeout(() => {
        setSavedFlashSection((currentSection) =>
          currentSection === section ? null : currentSection,
        );
        savedFlashTimer.current = null;
      }, 1800);
    } catch {
      setStudioNotice("Network error while saving edits");
    } finally {
      setSavingSection(null);
    }
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

  const replacePlanBlocks = (planBlocks: LessonPlanBlock[]): void => {
    if (!activeWorkspace || activeWorkspace.isSample) return;
    patchWorkspaceRemote(activeWorkspace.id, { planBlocks });
  };

  const updateLessonTitle = (title: string): void => {
    if (!activeWorkspace || activeWorkspace.isSample) return;
    patchWorkspaceRemote(activeWorkspace.id, { title });
  };

  useEffect(() => {
    setWorkflowOverride(null);
  }, [activeLessonId]);

  useEffect(() => {
    if (!activeLessonId) return;
    const lesson = lessonsRef.current.find((item) => item.id === activeLessonId);
    if (!lesson) return;
    if (studioBaselines.current.has(lesson.id)) return;
    const hasMaterials =
      (lesson.slides?.length ?? 0) > 0 ||
      (lesson.questions?.length ?? 0) > 0 ||
      (lesson.homework?.length ?? 0) > 0;
    if (!hasMaterials) return;
    studioBaselines.current.set(lesson.id, snapshotStudioBaseline(lesson));
    setBaselineVersion((value) => value + 1);
  }, [
    activeLessonId,
    activeWorkspace?.slides?.length,
    activeWorkspace?.questions?.length,
    activeWorkspace?.homework?.length,
  ]);

  const studioBaseline = activeWorkspace
    ? studioBaselines.current.get(activeWorkspace.id)
    : undefined;
  void baselineVersion;

  const slidesDirty = Boolean(
    activeWorkspace &&
      studioBaseline &&
      JSON.stringify(activeWorkspace.slides ?? []) !== studioBaseline.slides,
  );
  const questionsDirty = Boolean(
    activeWorkspace &&
      studioBaseline &&
      JSON.stringify(activeWorkspace.questions ?? []) !==
        studioBaseline.questions,
  );
  const homeworkDirty = Boolean(
    activeWorkspace &&
      studioBaseline &&
      JSON.stringify(activeWorkspace.homework ?? []) !==
        studioBaseline.homework,
  );
  const studioHasUnsavedEdits =
    slidesDirty || questionsDirty || homeworkDirty;

  useEffect(() => {
    if (!studioHasUnsavedEdits) return undefined;
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [studioHasUnsavedEdits]);

  useEffect(() => {
    return () => {
      if (savedFlashTimer.current) {
        window.clearTimeout(savedFlashTimer.current);
      }
    };
  }, []);

  const toggleWorkspaceDeliverable = (
    key: "slides" | "kahootTest" | "homework",
  ): void => {
    if (!activeWorkspace || activeWorkspace.isSample) return;
    const deliverables: LessonDeliverableFlags = {
      ...activeWorkspace.deliverables,
      [key]: !activeWorkspace.deliverables[key],
    };
    patchWorkspaceRemote(activeWorkspace.id, { deliverables });
  };

  const updateWorkspaceDeliverableCount = (
    key: "slideCount" | "quizCount" | "homeworkCount",
    value: number,
  ): void => {
    if (!activeWorkspace || activeWorkspace.isSample) return;
    const deliverables: LessonDeliverableFlags = {
      ...activeWorkspace.deliverables,
      [key]: value,
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

  const hasStudioMaterials = Boolean(
    activeWorkspace &&
      ((activeWorkspace.slides ?? []).length > 0 ||
        (activeWorkspace.questions ?? []).length > 0 ||
        (activeWorkspace.homework ?? []).length > 0),
  );

  void studioOpenedTick;

  const derivedStage: StudioWorkflowStage = !activeWorkspace
    ? "setup"
    : activeWorkspace.stage === "generating_plan"
      ? "setup"
      : activeWorkspace.stage === "generating_materials"
        ? hasStudioMaterials
          ? isStudioOpened(activeWorkspace.id)
            ? "studio"
            : "preview"
          : "review_plan"
        : activeWorkspace.stage === "failed"
          ? activeWorkspace.planBlocks.length > 0
            ? hasStudioMaterials
              ? isStudioOpened(activeWorkspace.id)
                ? "studio"
                : "preview"
              : "review_plan"
            : "setup"
          : activeWorkspace.stage === "review_plan"
            ? "review_plan"
            : hasStudioMaterials
              ? isStudioOpened(activeWorkspace.id)
                ? "studio"
                : "preview"
              : "review_plan";

  const currentStage: StudioWorkflowStage = workflowOverride ?? derivedStage;

  useEffect(() => {
    if (!teacher || !urlHydrated.current) return;

    const params = new URLSearchParams();
    if (currentStage === "setup" || !activeLessonId) {
      if (setupDraft.bookId) params.set("bookId", setupDraft.bookId);
      params.set("unit", String(setupDraft.unitIndex + 1));
    } else {
      params.set("lesson", activeLessonId);
      const stage = stageToUrlParam(currentStage);
      if (stage) params.set("stage", stage);
      if (currentStage === "studio") {
        if (studioTab !== "book") {
          params.set("tab", tabToUrlParam(studioTab));
        }
        if (studioTab === "slides" && slideIndex > 0) {
          params.set("slide", String(slideIndex + 1));
        }
      }
    }

    const next = params.toString();
    const current = searchParams.toString();
    if (next === current) return;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [
    teacher,
    currentStage,
    activeLessonId,
    setupDraft.bookId,
    setupDraft.unitIndex,
    studioTab,
    slideIndex,
    pathname,
    router,
    searchParams,
  ]);

  const handleJumpStage = (target: StudioWorkflowStage): void => {
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
      setWorkflowOverride(null);
      setActiveLessonId(null);
      return;
    }
    if (!activeWorkspace) return;
    if (target === "preview" && !hasStudioMaterials) return;
    if (target === "studio") {
      if (!hasStudioMaterials) return;
      markStudioOpened(activeWorkspace.id);
      setStudioOpenedTick((value) => value + 1);
    }
    setWorkflowOverride(target);
    setActiveLessonId(activeWorkspace.id);
  };

  const openTeachingStudio = (): void => {
    if (!activeWorkspace) return;
    markStudioOpened(activeWorkspace.id);
    setStudioOpenedTick((value) => value + 1);
    setWorkflowOverride("studio");
  };

  const handleSignOut = async (): Promise<void> => {
    await fetch("/api/auth/logout", { method: "POST" });
    setTeacher(null);
    setLessons([]);
    setActiveLessonId(null);
  };

  const handleDeleteLesson = (lessonId: string): void => {
    const target = lessons.find((item) => item.id === lessonId);
    if (!target || target.isSample) return;
    const confirmed = window.confirm(
      `Delete “${target.title}”? This cannot be undone.`,
    );
    if (!confirmed) return;
    void (async () => {
      const res = await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStudioNotice(data.error ?? "Could not delete lesson");
        return;
      }
      clearStudioOpened(lessonId);
      setLessons((prev) => prev.filter((item) => item.id !== lessonId));
      if (activeLessonId === lessonId) {
        setActiveLessonId(null);
        setWorkflowOverride(null);
      }
    })();
  };

  const handleAccessChange = async (access: LessonAccess): Promise<void> => {
    if (!activeWorkspace || activeWorkspace.isSample) return;
    let res: Response;
    try {
      res = await fetch(`/api/lessons/${activeWorkspace.id}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access }),
      });
    } catch {
      throw new Error(
        "Could not change the status. Check the connection and try again.",
      );
    }
    const data = (await res.json().catch(() => ({}))) as {
      lesson?: LessonWorkspace;
      error?: string;
    };
    if (res.status === 401) {
      setTeacher(null);
      throw new Error("Sign in again to change who can open this lesson.");
    }
    if (res.status === 404) {
      throw new Error("This lesson is no longer available.");
    }
    if (!res.ok || !data.lesson) {
      throw new Error(
        data.error ?? "Could not change the status. Try again.",
      );
    }
    upsertLesson(data.lesson);
  };

  const rail = (
    <LessonStudioRail
      lessons={lessons}
      activeLessonId={activeLessonId}
      currentStage={currentStage}
      canJumpToPlan={Boolean(activeWorkspace)}
      canJumpToPreview={hasStudioMaterials}
      canJumpToStudio={Boolean(
        hasStudioMaterials &&
          (currentStage === "preview" ||
            currentStage === "studio" ||
            (activeWorkspace !== null && isStudioOpened(activeWorkspace.id))),
      )}
      teacherName={teacher?.displayName ?? null}
      onSignOut={() => {
        void handleSignOut();
      }}
      onStartNew={() => {
        setWorkflowOverride(null);
        setActiveLessonId(null);
      }}
      onJumpStage={handleJumpStage}
      onSelectLesson={(id) => {
        setWorkflowOverride(null);
        setActiveLessonId(id);
        setStudioTab("book");
        setSlideIndex(0);
        void (async () => {
          const res = await fetch(`/api/lessons/${id}`);
          if (!res.ok) return;
          const data = (await res.json()) as { lesson?: LessonWorkspace };
          if (data.lesson) upsertLesson(data.lesson);
        })();
      }}
      onDeleteLesson={handleDeleteLesson}
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
    currentStage === "setup" ||
    !activeWorkspace ||
    activeWorkspace.stage === "generating_plan";

  const showPlanReview =
    Boolean(activeWorkspace) &&
    currentStage === "review_plan" &&
    (activeWorkspace?.stage === "generating_materials"
      ? !hasStudioMaterials
      : true);

  const showPreview =
    Boolean(activeWorkspace) &&
    currentStage === "preview" &&
    hasStudioMaterials;

  const showStudio =
    Boolean(activeWorkspace) &&
    currentStage === "studio" &&
    hasStudioMaterials;

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
        <div className="mb-6 flex max-w-lg flex-col items-start gap-2">
          <p className="text-sm font-medium leading-5 text-[var(--status-failed)]">
            {studioNotice}
          </p>
          {lessonLoadFailed ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void openLessonFromUrl();
              }}
            >
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}
      {showSetup ? (
        <div key="stage-setup" className="oku-stage-enter">
          <LessonSetupView
            books={books}
            draft={setupDraft}
            generating={generatingPlan || activeWorkspace?.stage === "generating_plan"}
            unitConfirmed={Boolean(bookIdParam)}
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
            onUpdateTitle={updateLessonTitle}
            onUpdatePlanBlock={updatePlanBlock}
            onReplacePlanBlocks={replacePlanBlocks}
            onToggleDeliverable={toggleWorkspaceDeliverable}
            onUpdateDeliverableCount={updateWorkspaceDeliverableCount}
            onGenerateMaterials={handleGenerateMaterials}
          />
        </div>
      ) : showPreview && activeWorkspace ? (
        <div key={`stage-preview-${activeWorkspace.id}`} className="oku-stage-enter">
          <LessonPreviewView
            workspace={activeWorkspace}
            onBackToPlan={() => handleJumpStage("review_plan")}
            onOpenStudio={openTeachingStudio}
            toolbar={
              <LessonAccessControls
                workspace={activeWorkspace}
                onAccessChange={handleAccessChange}
              />
            }
          />
        </div>
      ) : showStudio && activeWorkspace ? (
        <div key={`stage-studio-${activeWorkspace.id}`} className="oku-stage-enter">
          <header className="flex flex-col gap-4 border-b border-[var(--border-hairline)] pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 lg:flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-balance break-words text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
                  {activeWorkspace.title}
                </h2>
                {activeWorkspace.isSample ? (
                  <span className="rounded-[var(--rounded-xs)] border border-[var(--border-control)] bg-[var(--bg-surface)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                    Sample lesson
                  </span>
                ) : null}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                <span>{activeWorkspace.bookTitle}</span>
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

            <div className="flex flex-wrap items-center gap-2">
              <LessonAccessControls
                workspace={activeWorkspace}
                onAccessChange={handleAccessChange}
              />
              {activeWorkspace.questions.length > 0 &&
              (activeWorkspace.access === "private" ||
                activeWorkspace.access === "public" ||
                activeWorkspace.isSample) ? (
                <HoverLabel panel="Student quiz, opens in a new tab" align="end">
                  <Link
                    href={`/play/${activeWorkspace.shareCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Student quiz, opens in a new tab"
                    className={buttonClasses({
                      variant: "ghost",
                      size: "sm",
                      className: "px-2 coarse:min-h-11 coarse:min-w-11",
                    })}
                  >
                    <ExternalLinkIcon />
                  </Link>
                </HoverLabel>
              ) : null}
              {activeWorkspace.slides.length > 0 ? (
                <HoverLabel panel="Start teaching" align="end">
                  <Button
                    size="sm"
                    aria-label="Start teaching"
                    onClick={() => openPresenter(0)}
                  >
                    <PlayIcon />
                    <span className="hidden sm:inline">Teach</span>
                  </Button>
                </HoverLabel>
              ) : null}
            </div>
          </header>

          <div
            role="tablist"
            aria-label="Lesson materials"
            className="-mx-4 mt-4 flex gap-2 overflow-x-auto border-b border-[var(--border-hairline)] px-4 pb-3 sm:mx-0 sm:px-0"
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              const order: StudioTab[] = ["book"];
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
                order[(current + delta + order.length) % order.length] ?? "book";
              setStudioTab(next);
              window.requestAnimationFrame(() => {
                document.getElementById(`studio-tab-${next}`)?.focus();
              });
            }}
          >
            <button
              id="studio-tab-book"
              role="tab"
              type="button"
              aria-selected={studioTab === "book"}
              aria-controls="studio-panel"
              tabIndex={studioTab === "book" ? 0 : -1}
              onClick={() => setStudioTab("book")}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors ${
                studioTab === "book"
                  ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                  : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <BookOpenIcon />
              <span className="sm:hidden">Book</span>
              <span className="hidden sm:inline">Textbook</span>
            </button>

            {activeWorkspace.slides.length > 0 ? (
              <button
                id="studio-tab-slides"
                role="tab"
                type="button"
                aria-selected={studioTab === "slides"}
                aria-controls="studio-panel"
                tabIndex={studioTab === "slides" ? 0 : -1}
                onClick={() => setStudioTab("slides")}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  studioTab === "slides"
                    ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <SlidesIcon />
                <span className="sm:hidden">Slides</span>
                <span className="hidden sm:inline">Slides &amp; uploads</span>
                <span className="font-[family-name:var(--font-mono)] tabular-nums">
                  {activeWorkspace.slides.length}
                </span>
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
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors ${
                studioTab === "plan"
                  ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                  : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <DocumentIcon />
              <span className="sm:hidden">Plan</span>
              <span className="hidden sm:inline">Lesson plan</span>
              <span className="font-[family-name:var(--font-mono)] tabular-nums">
                {activeWorkspace.planBlocks.length}
              </span>
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
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  studioTab === "kahoot"
                    ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <TrophyIcon />
                <span className="sm:hidden">Quiz</span>
                <span className="hidden sm:inline">Student quiz</span>
                <span className="font-[family-name:var(--font-mono)] tabular-nums">
                  {activeWorkspace.questions.length}
                </span>
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
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--rounded-xs)] border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  studioTab === "homework"
                    ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                Homework
                <span className="font-[family-name:var(--font-mono)] tabular-nums">
                  {activeWorkspace.homework.length}
                </span>
              </button>
            ) : null}
          </div>

          <div
            id="studio-panel"
            role="tabpanel"
            aria-labelledby={`studio-tab-${studioTab}`}
            className="mt-6"
          >
            {studioTab === "book" ? (
              <LessonBookPanel lessonId={activeWorkspace.id} />
            ) : null}

            {studioTab === "slides" && activeWorkspace.slides.length > 0 ? (
              <LessonSlidesPanel
                slides={activeWorkspace.slides}
                shareCode={activeWorkspace.shareCode}
                readOnly={activeWorkspace.isSample}
                dirty={slidesDirty}
                saving={savingSection === "slides"}
                justSaved={savedFlashSection === "slides"}
                selectedIndex={slideIndex}
                onSelectedIndexChange={setSlideIndex}
                onChangeSlides={(slides) =>
                  patchWorkspace(activeWorkspace.id, { slides })
                }
                onSave={() =>
                  void saveWorkspaceSection(activeWorkspace.id, "slides")
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
                readOnly={activeWorkspace.isSample}
                dirty={questionsDirty}
                saving={savingSection === "questions"}
                justSaved={savedFlashSection === "questions"}
                onChangeQuestions={(questions) =>
                  patchWorkspace(activeWorkspace.id, { questions })
                }
                onSave={() =>
                  void saveWorkspaceSection(activeWorkspace.id, "questions")
                }
              />
            ) : null}

            {studioTab === "homework" && activeWorkspace.homework.length > 0 ? (
              <LessonHomeworkPanel
                shareCode={activeWorkspace.shareCode}
                lessonTitle={activeWorkspace.title}
                homework={activeWorkspace.homework}
                attempts={activeWorkspace.homeworkLeaderboard}
                readOnly={activeWorkspace.isSample}
                dirty={homeworkDirty}
                saving={savingSection === "homework"}
                justSaved={savedFlashSection === "homework"}
                onChangeHomework={(homework) =>
                  patchWorkspace(activeWorkspace.id, { homework })
                }
                onSave={() =>
                  void saveWorkspaceSection(activeWorkspace.id, "homework")
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
