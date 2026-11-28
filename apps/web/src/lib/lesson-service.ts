import {
  learningEvents,
  lessonAssets,
  lessonJobs,
  lessons,
  quizAttemptItems,
  quizAttempts,
  quizQuestions,
  type HomeworkItemJson,
  type Lesson,
  type LessonAsset,
  type LessonDeliverablesJson,
  type LessonGroundingJson,
  type LessonJob,
  type LessonPlanBlockJson,
  type LessonSlideJson,
  type QuizAttempt,
  type QuizQuestion,
} from "@oku/db";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb } from "./db";
import type {
  HomeworkItem,
  KahootQuestion,
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

const MARKDOWN_CAP = 12_000;

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

const questionToKahoot = (question: QuizQuestion): KahootQuestion => ({
  id: question.id,
  prompt: question.prompt,
  scenarioNote: question.scenarioNote,
  timeLimitSec: question.timeLimitSec,
  points: question.points,
  choices: question.choices.map((choice) => ({
    ...choice,
    isCorrect: choice.id === question.correctChoiceId,
  })),
  explanation: question.explanation,
});

const publicQuestion = (question: QuizQuestion): KahootQuestion => ({
  ...questionToKahoot(question),
  choices: question.choices.map((choice) => ({
    ...choice,
    isCorrect: false,
  })),
  explanation: "",
});

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
  options?: { hideAnswers?: boolean },
): LessonWorkspace & {
  jobStatus?: string | null;
  jobError?: string | null;
  dbStage?: Lesson["stage"];
} => {
  const { lesson, assets, questions, attempts, latestJob } = bundle;
  const sampleLeaderboard = lesson.isSample
    ? createPrebuiltSoccerLesson().leaderboard.filter((row) => row.isSample)
    : [];
  const liveLeaderboard = latestAttemptsLeaderboard(attempts);
  const mappedQuestions = options?.hideAnswers
    ? questions.map(publicQuestion)
    : questions.map(questionToKahoot);

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
    questions: mappedQuestions,
    homework: lesson.homework as HomeworkItem[],
    leaderboard: [...liveLeaderboard, ...sampleLeaderboard].sort(
      (left, right) => right.scorePoints - left.scorePoints,
    ),
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
  lesson: Lesson,
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
  questions: QuizQuestion[];
  answers: Array<{ questionId: string; choiceId: string; elapsedSec: number }>;
}): {
  scorePoints: number;
  correctCount: number;
  masteryRatio: number;
  bestStreak: number;
  durationSec: number;
  gradeFiveScale: 2 | 3 | 4 | 5;
  items: Array<{
    questionId: string;
    choiceId: string | null;
    isCorrect: boolean;
    timeSpentSec: number;
  }>;
} => {
  let scorePoints = 0;
  let correctCount = 0;
  let streak = 0;
  let bestStreak = 0;
  let durationSec = 0;
  const byId = new Map(input.questions.map((q) => [q.id, q]));
  const items = input.questions.map((question) => {
    const answer = input.answers.find((row) => row.questionId === question.id);
    const elapsed = Math.max(0, Math.round(answer?.elapsedSec ?? 0));
    durationSec += elapsed;
    const isCorrect = answer?.choiceId === question.correctChoiceId;
    if (isCorrect) {
      correctCount += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      const speedBonus = Math.max(
        0,
        1 - elapsed / Math.max(1, question.timeLimitSec),
      );
      scorePoints += Math.round(question.points * (0.5 + 0.5 * speedBonus));
    } else {
      streak = 0;
    }
    return {
      questionId: question.id,
      choiceId: answer?.choiceId ?? null,
      isCorrect,
      timeSpentSec: elapsed,
    };
  });
  const total = input.questions.length || 1;
  const masteryRatio = correctCount / total;
  return {
    scorePoints,
    correctCount,
    masteryRatio,
    bestStreak,
    durationSec,
    gradeFiveScale: gradeFromRatio(masteryRatio),
    items,
  };
};

export const insertAttemptBundle = async (input: {
  lesson: Lesson;
  studentId: string;
  displayName: string;
  scored: ReturnType<typeof scoreAttempt>;
}): Promise<{ attemptId: string }> => {
  const db = getDb();
  const [attempt] = await db
    .insert(quizAttempts)
    .values({
      lessonId: input.lesson.id,
      studentId: input.studentId,
      displayName: input.displayName,
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
        choiceId: item.choiceId,
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
  homework?: HomeworkItemJson[];
  deliverables?: LessonDeliverablesJson;
  questions?: KahootQuestion[];
  creativeAngle?: string;
  audience?: string;
  amountOfLessons?: number;
  minutesPerLesson?: number;
};

export const replaceQuestions = async (
  lessonId: string,
  questions: KahootQuestion[],
): Promise<void> => {
  const db = getDb();
  await db.delete(quizQuestions).where(eq(quizQuestions.lessonId, lessonId));
  if (questions.length === 0) return;
  await db.insert(quizQuestions).values(
    questions.map((question, orderIndex) => {
      const correct =
        question.choices.find((choice) => choice.isCorrect)?.id ??
        question.choices[0]?.id ??
        "";
      return {
        id: question.id.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        )
          ? question.id
          : undefined,
        lessonId,
        orderIndex,
        prompt: question.prompt,
        scenarioNote: question.scenarioNote,
        choices: question.choices.map(({ id, shape, text }) => ({
          id,
          shape,
          text,
        })),
        correctChoiceId: correct,
        explanation: question.explanation,
        timeLimitSec: question.timeLimitSec,
        points: question.points,
      };
    }),
  );
};

/** Ensures the sample free-kick lesson exists once (seed only; not the generation path). */
export const ensureSampleLesson = async (): Promise<void> => {
  const db = getDb();
  const existing = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.shareCode, SAMPLE_SHARE_CODE))
    .limit(1);
  if (existing.length > 0) return;

  const sample = createPrebuiltSoccerLesson();
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
      homework: sample.homework,
      grounding: null,
      conceptId: null,
      isSample: true,
    })
    .returning();

  if (!row) return;

  if (sample.questions.length > 0) {
    await db.insert(quizQuestions).values(
      sample.questions.map((question, orderIndex) => ({
        lessonId: row.id,
        orderIndex,
        prompt: question.prompt,
        scenarioNote: question.scenarioNote,
        choices: question.choices.map(({ id, shape, text }) => ({
          id,
          shape,
          text,
        })),
        correctChoiceId:
          question.choices.find((choice) => choice.isCorrect)?.id ??
          question.choices[0]!.id,
        explanation: question.explanation,
        timeLimitSec: question.timeLimitSec,
        points: question.points,
      })),
    );
  }
};
