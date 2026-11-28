import {
  learningEvents,
  lessonAssets,
  lessonJobs,
  lessons,
  quizAttemptItems,
  quizAttempts,
  quizQuestions,
  type Lesson,
  type LessonAsset,
  type LessonDeliverablesJson,
  type LessonGroundingJson,
  type LessonJob,
  type LessonPlanBlockJson,
  type LessonSlideJson,
  type QuizAnswerKeyJson,
  type QuizAttempt,
  type QuizPlacement,
  type QuizQuestion,
  type QuizSpecJson,
} from "@oku/db";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb } from "./db";
import type {
  LessonPlanBlock,
  LessonSlide,
  LessonStage,
  LessonWorkspace,
  QuizLeaderboardEntry,
  StudioAttachment,
  StudioBookOption,
  StudioUnitOption,
} from "./lesson-studio";
import { createPrebuiltSoccerLesson, gradeFromRatio } from "./lesson-studio";
import {
  buildReveal,
  grade,
  mergeQuizConfig,
  rowToQuizItem,
  splitItemForStorage,
  type QuizConfig,
  type QuizItem,
  type QuizItemKind,
  type QuizResponse,
  type QuizReveal,
  type QuizResult,
} from "./quiz";

const MARKDOWN_CAP = 12_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SAMPLE_SHARE_CODE = "ek-soccer-9a";

export const newShareCode = (): string =>
  randomBytes(4).toString("hex").slice(0, 7);

export const mapDbStageToUi = (
  stage: Lesson["stage"],
): LessonStage | "generating_plan" | "generating_materials" | "failed" => {
  if (stage === "studio" || stage === "review_plan") return stage;
  return stage;
};

export const mapUiStage = (
  stage: Lesson["stage"],
): LessonWorkspace["stage"] => stage;

const assetToAttachment = (asset: LessonAsset): StudioAttachment => ({
  id: asset.id,
  name: asset.name,
  kind:
    asset.kind === "image"
      ? "image"
      : asset.kind === "pdf"
        ? "pdf_slides"
        : "notes",
  previewUrl: asset.url,
  notesText: asset.notesText,
  useInAi: asset.useInAi,
  includeAsSlide: asset.includeAsSlide,
});

const questionRowToItem = (
  question: QuizQuestion,
  hideAnswers?: boolean,
): QuizItem =>
  rowToQuizItem(
    {
      id: question.id,
      kind: question.kind as QuizItemKind,
      prompt: question.prompt,
      scenarioNote: question.scenarioNote,
      explanation: question.explanation,
      timeLimitSec: question.timeLimitSec,
      points: question.points,
      requireExplanation: question.requireExplanation,
      spec: question.spec as QuizSpecJson,
      answerKey: question.answerKey as QuizAnswerKeyJson,
    },
    { hideAnswers },
  );

export const attemptToLeaderboard = (
  attempt: QuizAttempt,
  isSample = false,
): QuizLeaderboardEntry => ({
  id: attempt.id,
  studentName: attempt.displayName,
  scorePoints: attempt.scorePoints,
  correctCount: attempt.correctCount,
  totalQuestions: attempt.totalQuestions,
  bestStreak: attempt.bestStreak,
  durationSec: attempt.durationSec,
  gradeFiveScale: attempt.gradeFiveScale as 2 | 3 | 4 | 5,
  submittedAt: isSample ? "Sample" : attempt.createdAt.toISOString(),
  isSample,
});

/** Latest attempt per student, highest score first. */
export const latestAttemptsLeaderboard = (
  attempts: QuizAttempt[],
): QuizLeaderboardEntry[] => {
  const byStudent = new Map<string, QuizAttempt>();
  for (const attempt of attempts) {
    const existing = byStudent.get(attempt.studentId);
    if (!existing || attempt.createdAt > existing.createdAt) {
      byStudent.set(attempt.studentId, attempt);
    }
  }
  return [...byStudent.values()]
    .map((attempt) => attemptToLeaderboard(attempt))
    .sort((left, right) => right.scorePoints - left.scorePoints);
};

export interface LessonBundle {
  lesson: Lesson;
  assets: LessonAsset[];
  questions: QuizQuestion[];
  attempts: QuizAttempt[];
  latestJob: LessonJob | null;
}

export const loadLessonBundle = async (
  lessonId: string,
): Promise<LessonBundle | null> => {
  const db = getDb();
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) return null;

  const [assets, questions, attempts, jobs] = await Promise.all([
    db
      .select()
      .from(lessonAssets)
      .where(eq(lessonAssets.lessonId, lessonId)),
    db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.lessonId, lessonId))
      .orderBy(asc(quizQuestions.orderIndex)),
    db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.lessonId, lessonId))
      .orderBy(desc(quizAttempts.createdAt)),
    db
      .select()
      .from(lessonJobs)
      .where(eq(lessonJobs.lessonId, lessonId))
      .orderBy(desc(lessonJobs.createdAt))
      .limit(1),
  ]);

  return {
    lesson,
    assets,
    questions,
    attempts,
    latestJob: jobs[0] ?? null,
  };
};

/** Ownership check for a write. Skips slides, grounding, questions, and attempts. */
export interface LessonAccess {
  id: string;
  teacherId: string | null;
  isSample: boolean;
}

export const loadLessonAccess = async (
  lessonId: string,
): Promise<LessonAccess | null> => {
  const db = getDb();
  const [lesson] = await db
    .select({
      id: lessons.id,
      teacherId: lessons.teacherId,
      isSample: lessons.isSample,
    })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return lesson ?? null;
};

export const loadLessonByShareCode = async (
  shareCode: string,
): Promise<LessonBundle | null> => {
  const db = getDb();
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.shareCode, shareCode.trim().toLowerCase()))
    .limit(1);
  if (!lesson) return null;
  return loadLessonBundle(lesson.id);
};

export const bundleToWorkspace = (
  bundle: LessonBundle,
  options?: { hideAnswers?: boolean; placement?: QuizPlacement },
): LessonWorkspace & {
  jobStatus?: string | null;
  jobError?: string | null;
  dbStage?: Lesson["stage"];
} => {
  const { lesson, assets, questions, attempts, latestJob } = bundle;
  const sampleLeaderboard = lesson.isSample
    ? createPrebuiltSoccerLesson().leaderboard.filter((row) => row.isSample)
    : [];
  const liveAttempts = attempts.filter((row) => row.placement === "live");
  const homeworkAttempts = attempts.filter(
    (row) => row.placement === "homework",
  );
  const liveLeaderboard = latestAttemptsLeaderboard(liveAttempts);
  const homeworkLeaderboard = latestAttemptsLeaderboard(homeworkAttempts);

  const liveQuestions = questions
    .filter((row) => row.placement === "live")
    .map((row) => questionRowToItem(row, options?.hideAnswers));
  const homeworkQuestions = questions
    .filter((row) => row.placement === "homework")
    .map((row) => questionRowToItem(row, options?.hideAnswers));

  return {
    id: lesson.id,
    shareCode: lesson.shareCode,
    title: lesson.title,
    isSample: lesson.isSample,
    bookId: lesson.bookId ?? lesson.unitKey,
    bookTitle: lesson.bookTitle,
    language: (lesson.language as "ky" | "ru" | "en") || "en",
    unitIndex: 0,
    unitTitle: lesson.unitTitle,
    pageRangeLabel: lesson.pageRangeLabel,
    audience: lesson.audience,
    amountOfLessons: lesson.amountOfLessons,
    minutesPerLesson: lesson.minutesPerLesson,
    creativeAngle: lesson.creativeAngle,
    deliverables: lesson.deliverables,
    stage: mapUiStage(lesson.stage),
    attachments: assets.map(assetToAttachment),
    planBlocks: lesson.planBlocks as LessonPlanBlock[],
    slides: lesson.slides as LessonSlide[],
    questions: liveQuestions,
    homework: homeworkQuestions,
    leaderboard: [...liveLeaderboard, ...sampleLeaderboard].sort(
      (left, right) => right.scorePoints - left.scorePoints,
    ),
    homeworkLeaderboard,
    updatedAt: lesson.updatedAt.toISOString(),
    jobStatus: latestJob?.status ?? null,
    jobError: latestJob?.error ?? null,
    dbStage: lesson.stage,
  };
};

export const listTeacherLessons = async (
  teacherId: string,
): Promise<LessonWorkspace[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(lessons)
    .where(or(eq(lessons.teacherId, teacherId), eq(lessons.isSample, true)))
    .orderBy(desc(lessons.updatedAt));

  const workspaces: LessonWorkspace[] = [];
  for (const row of rows) {
    const bundle = await loadLessonBundle(row.id);
    if (bundle) workspaces.push(bundleToWorkspace(bundle));
  }
  return workspaces;
};

export const teacherCanAccess = (
  lesson: Lesson,
  teacherId: string,
): boolean => {
  if (lesson.isSample) return true;
  return lesson.teacherId === teacherId;
};

export const teacherCanMutate = (
  lesson: { isSample: boolean; teacherId: string | null },
  teacherId: string,
): boolean => {
  if (lesson.isSample) return false;
  return lesson.teacherId === teacherId;
};

export const hasActiveJob = async (lessonId: string): Promise<boolean> => {
  const db = getDb();
  const rows = await db
    .select({ id: lessonJobs.id })
    .from(lessonJobs)
    .where(
      and(
        eq(lessonJobs.lessonId, lessonId),
        or(eq(lessonJobs.status, "queued"), eq(lessonJobs.status, "running")),
      ),
    )
    .limit(1);
  return rows.length > 0;
};

export const enqueueLessonJob = async (
  lessonId: string,
  kind: "plan" | "materials",
): Promise<void> => {
  const db = getDb();
  await db.insert(lessonJobs).values({
    lessonId,
    kind,
    status: "queued",
  });
};

export const buildGrounding = (input: {
  book: StudioBookOption;
  unit: StudioUnitOption;
  audience: string;
  amountOfLessons: number;
  minutesPerLesson: number;
  creativeAngle: string;
  noteAttachments: string[];
  markdownExcerpt?: string;
}): LessonGroundingJson => ({
  bookTitle: input.book.title,
  language: input.book.language,
  grade: input.book.grade,
  unitTitle: input.unit.title,
  pageRangeLabel: input.unit.pageRangeLabel,
  summary: input.unit.summary,
  keyTerms: input.unit.keyTerms,
  markdownExcerpt: (input.markdownExcerpt ?? input.unit.summary).slice(
    0,
    MARKDOWN_CAP,
  ),
  figures: input.unit.figures.map((figure) => ({
    caption: figure.caption,
    description: figure.description,
    pageLabel: figure.pageLabel,
  })),
  audience: input.audience,
  amountOfLessons: input.amountOfLessons,
  minutesPerLesson: input.minutesPerLesson,
  creativeAngle: input.creativeAngle,
  noteAttachments: input.noteAttachments,
});

export const scoreAttempt = (input: {
  questions: QuizItem[];
  answers: QuizResponse[];
  config?: Partial<QuizConfig>;
}): QuizResult & { gradeFiveScale: 2 | 3 | 4 | 5 } => {
  const scored = grade(input.questions, input.answers, input.config);
  return {
    ...scored,
    gradeFiveScale: gradeFromRatio(scored.masteryRatio),
  };
};

export const revealOneResponse = (input: {
  question: QuizItem;
  response: QuizResponse;
  config?: Partial<QuizConfig>;
}): QuizReveal =>
  buildReveal({
    question: input.question,
    response: input.response,
    config: mergeQuizConfig(input.config),
  });

export const insertAttemptBundle = async (input: {
  lesson: Lesson;
  studentId: string;
  displayName: string;
  placement: QuizPlacement;
  scored: ReturnType<typeof scoreAttempt>;
}): Promise<{ attemptId: string }> => {
  const db = getDb();
  const [attempt] = await db
    .insert(quizAttempts)
    .values({
      lessonId: input.lesson.id,
      studentId: input.studentId,
      displayName: input.displayName,
      placement: input.placement,
      scorePoints: input.scored.scorePoints,
      correctCount: input.scored.correctCount,
      totalQuestions: input.scored.items.length,
      masteryRatio: input.scored.masteryRatio,
      bestStreak: input.scored.bestStreak,
      durationSec: input.scored.durationSec,
      gradeFiveScale: input.scored.gradeFiveScale,
    })
    .returning();

  if (!attempt) {
    throw new Error("Failed to insert quiz attempt");
  }

  if (input.scored.items.length > 0) {
    await db.insert(quizAttemptItems).values(
      input.scored.items.map((item) => ({
        attemptId: attempt.id,
        questionId: item.questionId,
        response: item.response as unknown as Record<string, unknown>,
        isCorrect: item.isCorrect,
        timeSpentSec: item.timeSpentSec,
      })),
    );
  }

  await db.insert(learningEvents).values({
    studentId: input.studentId,
    lessonId: input.lesson.id,
    bookId: input.lesson.bookId,
    conceptId: input.lesson.conceptId,
    eventType: "quiz_completed",
    masteryRatio: input.scored.masteryRatio,
    gradeFiveScale: input.scored.gradeFiveScale,
    timeSpentSec: input.scored.durationSec,
  });

  return { attemptId: attempt.id };
};

export type PatchLessonBody = {
  title?: string;
  planBlocks?: LessonPlanBlockJson[];
  slides?: LessonSlideJson[];
  homework?: QuizItem[];
  deliverables?: LessonDeliverablesJson;
  questions?: QuizItem[];
  creativeAngle?: string;
  audience?: string;
  amountOfLessons?: number;
  minutesPerLesson?: number;
};

export const replaceQuestions = async (
  lessonId: string,
  questions: QuizItem[],
  placement: QuizPlacement = "live",
): Promise<void> => {
  const db = getDb();
  await db
    .delete(quizQuestions)
    .where(
      and(
        eq(quizQuestions.lessonId, lessonId),
        eq(quizQuestions.placement, placement),
      ),
    );
  if (questions.length === 0) return;
  await db.insert(quizQuestions).values(
    questions.map((question, orderIndex) => {
      const stored = splitItemForStorage(question);
      return {
        id: UUID_RE.test(question.id) ? question.id : undefined,
        lessonId,
        orderIndex,
        placement,
        kind: stored.kind,
        prompt: stored.prompt,
        scenarioNote: stored.scenarioNote,
        requireExplanation: stored.requireExplanation,
        spec: stored.spec as QuizSpecJson,
        answerKey: stored.answerKey as QuizAnswerKeyJson,
        explanation: stored.explanation,
        timeLimitSec: stored.timeLimitSec,
        points: stored.points,
      };
    }),
  );
};

/**
 * Writes only the fields present on the patch.
 * Slide text is the `slides` jsonb column; this does not read it back.
 */
export const applyLessonPatch = async (
  lessonId: string,
  body: PatchLessonBody,
): Promise<void> => {
  const db = getDb();
  const patch: {
    updatedAt: Date;
    title?: string;
    planBlocks?: LessonPlanBlockJson[];
    slides?: LessonSlideJson[];
    deliverables?: LessonDeliverablesJson;
    creativeAngle?: string;
    audience?: string;
    amountOfLessons?: number;
    minutesPerLesson?: number;
  } = { updatedAt: new Date() };

  if (body.title !== undefined) patch.title = body.title;
  if (body.planBlocks !== undefined) patch.planBlocks = body.planBlocks;
  if (body.slides !== undefined) patch.slides = body.slides;
  if (body.deliverables !== undefined) patch.deliverables = body.deliverables;
  if (body.creativeAngle !== undefined) patch.creativeAngle = body.creativeAngle;
  if (body.audience !== undefined) patch.audience = body.audience;
  if (body.amountOfLessons !== undefined) {
    patch.amountOfLessons = body.amountOfLessons;
  }
  if (body.minutesPerLesson !== undefined) {
    patch.minutesPerLesson = body.minutesPerLesson;
  }

  await db.update(lessons).set(patch).where(eq(lessons.id, lessonId));

  if (body.questions !== undefined) {
    await replaceQuestions(lessonId, body.questions, "live");
  }
  if (body.homework !== undefined) {
    await replaceQuestions(lessonId, body.homework, "homework");
  }
};

/** Ensures the sample free-kick lesson exists once (seed only; not the generation path). */
export const ensureSampleLesson = async (): Promise<void> => {
  const db = getDb();
  const existing = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.shareCode, SAMPLE_SHARE_CODE))
    .limit(1);

  const sample = createPrebuiltSoccerLesson();

  if (existing.length > 0) {
    const lessonId = existing[0]!.id;
    const homeworkRows = await db
      .select({ id: quizQuestions.id })
      .from(quizQuestions)
      .where(
        and(
          eq(quizQuestions.lessonId, lessonId),
          eq(quizQuestions.placement, "homework"),
        ),
      )
      .limit(1);
    // One-time upgrade for samples created before rich quiz items.
    if (homeworkRows.length === 0) {
      await db
        .update(lessons)
        .set({
          slides: sample.slides,
          homework: [],
          planBlocks: sample.planBlocks,
          updatedAt: new Date(),
        })
        .where(eq(lessons.id, lessonId));
      await replaceQuestions(lessonId, sample.questions, "live");
      await replaceQuestions(lessonId, sample.homework, "homework");
    }
    return;
  }

  const [row] = await db
    .insert(lessons)
    .values({
      shareCode: SAMPLE_SHARE_CODE,
      teacherId: null,
      bookId: null,
      unitKey: sample.bookId,
      unitTitle: sample.unitTitle,
      pageRangeLabel: sample.pageRangeLabel,
      bookTitle: sample.bookTitle,
      language: sample.language,
      audience: sample.audience,
      amountOfLessons: sample.amountOfLessons,
      minutesPerLesson: sample.minutesPerLesson,
      creativeAngle: sample.creativeAngle,
      deliverables: sample.deliverables,
      stage: "studio",
      title: sample.title,
      planBlocks: sample.planBlocks,
      slides: sample.slides,
      homework: [],
      grounding: null,
      conceptId: null,
      isSample: true,
    })
    .returning();

  if (!row) return;

  if (sample.questions.length > 0) {
    await replaceQuestions(row.id, sample.questions, "live");
  }
  if (sample.homework.length > 0) {
    await replaceQuestions(row.id, sample.homework, "homework");
  }
};
