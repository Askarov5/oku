import { NextResponse } from "next/server";
import {
  attemptToLeaderboard,
  bundleToWorkspace,
  insertAttemptBundle,
  latestAttemptsLeaderboard,
  lessonAllowsClassShare,
  loadLessonByShareCode,
  revealOneResponse,
  scoreAttempt,
} from "@/lib/lesson-service";
import { createPrebuiltSoccerLesson } from "@/lib/lesson-studio";
import { rowToQuizItem, type QuizResponse } from "@/lib/quiz";
import { requireUser } from "@/lib/user-session";

interface RouteContext {
  params: Promise<{ shareCode: string }>;
}

interface AttemptBody {
  placement?: "live" | "homework";
  answers?: QuizResponse[];
  /** Single-item reveal before the attempt is finalized. */
  reveal?: QuizResponse;
}

export const POST = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  const auth = await requireUser(request, "student");
  if ("error" in auth) return auth.error;

  const { shareCode } = await context.params;
  const bundle = await loadLessonByShareCode(shareCode);
  if (!bundle || !lessonAllowsClassShare(bundle.lesson)) {
    return NextResponse.json({ error: "Quiz code not found" }, { status: 404 });
  }

  const body = (await request.json()) as AttemptBody;
  const placement = body.placement === "homework" ? "homework" : "live";
  const config =
    placement === "homework"
      ? {
          timed: false,
          showResultLive: true,
          showExplanation: true,
          speedBonus: false,
          showSummary: true,
        }
      : {
          timed: true,
          showResultLive: true,
          showExplanation: false,
          speedBonus: true,
          showSummary: true,
        };

  const questions = bundle.questions
    .filter((row) => row.placement === placement)
    .map((row) =>
      rowToQuizItem({
        id: row.id,
        kind: row.kind,
        prompt: row.prompt,
        scenarioNote: row.scenarioNote,
        explanation: row.explanation,
        timeLimitSec: row.timeLimitSec,
        points: row.points,
        requireExplanation: row.requireExplanation,
        spec: row.spec,
        answerKey: row.answerKey,
      }),
    );

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "This lesson has no quiz yet" },
      { status: 400 },
    );
  }

  if (body.reveal) {
    const question = questions.find((row) => row.id === body.reveal!.questionId);
    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }
    const reveal = revealOneResponse({
      question,
      response: body.reveal,
      config,
    });
    return NextResponse.json({ reveal });
  }

  const answers = (body.answers ?? []).filter(
    (row): row is QuizResponse =>
      typeof row === "object" &&
      row !== null &&
      typeof row.questionId === "string" &&
      typeof row.kind === "string",
  );

  const scored = scoreAttempt({
    questions,
    answers,
    config,
  });

  const { attemptId } = await insertAttemptBundle({
    lesson: bundle.lesson,
    studentId: auth.user.id,
    displayName: auth.user.displayName,
    placement,
    scored,
  });

  const refreshed = await loadLessonByShareCode(shareCode);
  const live = refreshed
    ? latestAttemptsLeaderboard(
        refreshed.attempts.filter((row) => row.placement === "live"),
      )
    : [];
  const sampleRows =
    bundle.lesson.isSample && placement === "live"
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
    leaderboard: placement === "live" ? leaderboard : [],
    entry: attemptToLeaderboard({
      id: attemptId,
      lessonId: bundle.lesson.id,
      studentId: auth.user.id,
      displayName: auth.user.displayName,
      placement,
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
