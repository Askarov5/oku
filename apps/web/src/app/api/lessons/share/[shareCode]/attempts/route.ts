import { NextResponse } from "next/server";
import {
  attemptToLeaderboard,
  bundleToWorkspace,
  insertAttemptBundle,
  latestAttemptsLeaderboard,
  loadLessonByShareCode,
  scoreAttempt,
} from "@/lib/lesson-service";
import { createPrebuiltSoccerLesson } from "@/lib/lesson-studio";
import { requireUser } from "@/lib/user-session";

interface RouteContext {
  params: Promise<{ shareCode: string }>;
}

interface AttemptBody {
  answers?: Array<{
    questionId?: string;
    choiceId?: string;
    elapsedSec?: number;
  }>;
}

export const POST = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  const auth = await requireUser(request, "student");
  if ("error" in auth) return auth.error;

  const { shareCode } = await context.params;
  const bundle = await loadLessonByShareCode(shareCode);
  if (!bundle) {
    return NextResponse.json({ error: "Quiz code not found" }, { status: 404 });
  }
  if (bundle.questions.length === 0) {
    return NextResponse.json({ error: "This lesson has no quiz yet" }, { status: 400 });
  }

  const body = (await request.json()) as AttemptBody;
  const answers = (body.answers ?? [])
    .filter(
      (row): row is { questionId: string; choiceId: string; elapsedSec?: number } =>
        typeof row.questionId === "string",
    )
    .map((row) => ({
      questionId: row.questionId,
      choiceId: typeof row.choiceId === "string" ? row.choiceId : "",
      elapsedSec: Number(row.elapsedSec) || 0,
    }));

  const scored = scoreAttempt({
    questions: bundle.questions,
    answers,
  });

  const { attemptId } = await insertAttemptBundle({
    lesson: bundle.lesson,
    studentId: auth.user.id,
    displayName: auth.user.displayName,
    scored,
  });

  const refreshed = await loadLessonByShareCode(shareCode);
  const live = refreshed
    ? latestAttemptsLeaderboard(refreshed.attempts)
    : [];
  const sampleRows = bundle.lesson.isSample
    ? createPrebuiltSoccerLesson().leaderboard.filter((row) => row.isSample)
    : [];
  const leaderboard = [...live, ...sampleRows].sort(
    (left, right) => right.scorePoints - left.scorePoints,
  );

  return NextResponse.json({
    attemptId,
    scorePoints: scored.scorePoints,
    correctCount: scored.correctCount,
    totalQuestions: scored.items.length,
    masteryRatio: scored.masteryRatio,
    gradeFiveScale: scored.gradeFiveScale,
    bestStreak: scored.bestStreak,
    durationSec: scored.durationSec,
    leaderboard,
    entry: attemptToLeaderboard({
      id: attemptId,
      lessonId: bundle.lesson.id,
      studentId: auth.user.id,
      displayName: auth.user.displayName,
      scorePoints: scored.scorePoints,
      correctCount: scored.correctCount,
      totalQuestions: scored.items.length,
      masteryRatio: scored.masteryRatio,
      bestStreak: scored.bestStreak,
      durationSec: scored.durationSec,
      gradeFiveScale: scored.gradeFiveScale,
      createdAt: new Date(),
    }),
    lesson: refreshed
      ? bundleToWorkspace(refreshed, { hideAnswers: true })
      : null,
  });
};
