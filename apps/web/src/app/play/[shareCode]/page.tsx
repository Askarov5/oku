"use client";

import {
  Button,
  MoonIcon,
  SunIcon,
  buttonClasses,
} from "@oku/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactElement } from "react";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  AccountAuthForm,
  type AuthUser,
} from "@/components/lessons/account-auth-form";
import { GradePill } from "@/components/lessons/grade-pill";
import {
  ChoiceShapeMark,
  ClockIcon,
  PlayIcon,
  TrophyIcon,
} from "@/components/lessons/lesson-icons";
import type {
  KahootChoice,
  KahootChoiceShape,
  LessonWorkspace,
  QuizLeaderboardEntry,
} from "@/lib/lesson-studio";

type PlayPhase = "lobby" | "question" | "reveal" | "summary";

interface AnswerDraft {
  questionId: string;
  choiceId: string;
  elapsedSec: number;
}

const CHOICE_BUTTON_CLASS: Record<KahootChoiceShape, string> = {
  triangle:
    "bg-[var(--choice-a)] text-[var(--on-choice)] hover:bg-[var(--choice-a-hover)]",
  diamond:
    "bg-[var(--choice-b)] text-[var(--on-choice)] hover:bg-[var(--choice-b-hover)]",
  circle:
    "bg-[var(--choice-c)] text-[var(--on-choice)] hover:bg-[var(--choice-c-hover)]",
  square:
    "bg-[var(--choice-d)] text-[var(--on-choice)] hover:bg-[var(--choice-d-hover)]",
};

const THEME_STORAGE_KEY = "oku-theme";

const StudentQuizPlayPage = (): ReactElement => {
  const params = useParams<{ shareCode: string }>();
  const shareCode = params.shareCode;

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lesson, setLesson] = useState<LessonWorkspace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [student, setStudent] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [phase, setPhase] = useState<PlayPhase>("lobby");
  const [qIndex, setQIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerDraft[]>([]);
  const [questionStartedAt, setQuestionStartedAt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [finalEntry, setFinalEntry] = useState<QuizLeaderboardEntry | null>(
    null,
  );

  useLayoutEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") {
      setTheme(attr);
    }
  }, []);

  const toggleTheme = (): void => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore private mode errors.
    }
  };

  useEffect(() => {
    let active = true;
    const boot = async (): Promise<void> => {
      try {
        const res = await fetch("/api/auth/me");
        if (!active) return;
        if (res.ok) {
          const data = (await res.json()) as { user?: AuthUser };
          if (data.user?.role === "student") {
            setStudent(data.user);
          }
        }
      } catch {
        // Stay signed out.
      } finally {
        if (active) setAuthChecked(true);
      }
    };
    void boot();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadQuiz = async (): Promise<void> => {
      try {
        const res = await fetch(
          `/api/lessons/share/${encodeURIComponent(shareCode)}`,
        );
        if (res.ok && active) {
          const data = (await res.json()) as { lesson?: LessonWorkspace };
          if (data.lesson) {
            setLesson(data.lesson);
          }
        }
      } catch {
        // Offline: leave lesson null.
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    };
    void loadQuiz();
    return () => {
      active = false;
    };
  }, [shareCode]);

  const questions = lesson?.questions ?? [];
  const currentQuestion = questions[qIndex] ?? null;

  useEffect(() => {
    if (phase !== "question" || !currentQuestion) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setSelectedChoiceId("__timeout__");
          setAnswers((prevAnswers) => [
            ...prevAnswers.filter(
              (row) => row.questionId !== currentQuestion.id,
            ),
            {
              questionId: currentQuestion.id,
              choiceId: "",
              elapsedSec: currentQuestion.timeLimitSec,
            },
          ]);
          setPhase("reveal");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, currentQuestion]);

  const startGame = (): void => {
    if (!student || questions.length === 0) return;
    setQIndex(0);
    setAnswers([]);
    setSelectedChoiceId(null);
    setSecondsLeft(questions[0]!.timeLimitSec);
    setQuestionStartedAt(Date.now());
    setSubmitError(null);
    setFinalEntry(null);
    setPhase("question");
  };

  const chooseAnswer = (choice: KahootChoice): void => {
    if (phase !== "question" || !currentQuestion) return;
    setSelectedChoiceId(choice.id);
    const elapsedSec = Math.max(
      0,
      Math.round((Date.now() - questionStartedAt) / 1000),
    );
    setAnswers((prev) => [
      ...prev.filter((row) => row.questionId !== currentQuestion.id),
      {
        questionId: currentQuestion.id,
        choiceId: choice.id,
        elapsedSec,
      },
    ]);
    setPhase("reveal");
  };

  const finishWithServer = async (
    finalAnswers: AnswerDraft[],
  ): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        `/api/lessons/share/${encodeURIComponent(shareCode)}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: finalAnswers,
          }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        entry?: QuizLeaderboardEntry;
        leaderboard?: QuizLeaderboardEntry[];
        lesson?: LessonWorkspace;
      };
      if (!res.ok || !data.entry) {
        setSubmitError(data.error ?? "Could not submit quiz");
        return;
      }
      setFinalEntry(data.entry);
      if (data.lesson) {
        setLesson({
          ...data.lesson,
          leaderboard: data.leaderboard ?? data.lesson.leaderboard,
        });
      } else if (data.leaderboard && lesson) {
        setLesson({ ...lesson, leaderboard: data.leaderboard });
      }
      setPhase("summary");
    } catch {
      setSubmitError("Network error while submitting");
    } finally {
      setSubmitting(false);
    }
  };

  const advanceQuestion = (): void => {
    if (!lesson) return;
    const nextIdx = qIndex + 1;
    if (nextIdx < questions.length) {
      setQIndex(nextIdx);
      setSelectedChoiceId(null);
      setSecondsLeft(questions[nextIdx]!.timeLimitSec);
      setQuestionStartedAt(Date.now());
      setPhase("question");
      return;
    }
    void finishWithServer(answers);
  };

  const handleSignOut = async (): Promise<void> => {
    await fetch("/api/auth/logout", { method: "POST" });
    setStudent(null);
    setPhase("lobby");
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <header
        data-surface="rail"
        className="flex items-center justify-between gap-3 border-b-4 border-[var(--accent-primary)] bg-[var(--bg-rail)] px-4 py-3 text-[var(--text-on-rail)] sm:px-8"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-xl font-bold tracking-[-0.02em]">oku</span>
          <span aria-hidden className="h-4 w-px bg-[var(--rail-line)]" />
          <p className="truncate text-sm font-medium">
            {lesson ? lesson.title : "Class Quiz"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {student ? (
            <span className="hidden max-w-[10rem] truncate font-[family-name:var(--font-mono)] text-xs sm:inline">
              {student.displayName}
            </span>
          ) : null}
          {student ? (
            <Button variant="rail" size="sm" onClick={() => void handleSignOut()}>
              Sign out
            </Button>
          ) : null}
          <Button variant="rail" size="sm" onClick={toggleTheme}>
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
            {theme === "light" ? "Night" : "Day"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {!loaded && !lesson ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading quiz…</p>
        ) : !lesson || questions.length === 0 ? (
          <section
            aria-labelledby="quiz-not-found-heading"
            className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8"
          >
            <h1
              id="quiz-not-found-heading"
              className="text-2xl font-bold tracking-[-0.02em]"
            >
              Quiz code not found
            </h1>
            <p className="mt-2 max-w-[58ch] text-sm leading-6 text-[var(--text-secondary)]">
              No active classroom quiz matched join code{" "}
              <code className="font-[family-name:var(--font-mono)] text-[var(--text-primary)]">
                {shareCode}
              </code>
              . Ask your teacher to check the projected link or try the sample
              physics quiz below.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/play/ek-soccer-9a"
                className={buttonClasses({ variant: "primary" })}
              >
                Open sample quiz
              </Link>
              <Link
                href="/lessons"
                className={buttonClasses({ variant: "secondary" })}
              >
                Open Lesson Studio
              </Link>
            </div>
          </section>
        ) : phase === "lobby" ? (
          <section className="grid gap-6">
            <div className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8">
              <h1 className="text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
                {lesson.title}
              </h1>
              <p className="mt-2 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                {questions.length} timed questions · Server-graded (2–5 scale)
              </p>
              {authChecked && student ? (
                <div className="mt-6 space-y-4">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Playing as{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {student.displayName}
                    </span>
                  </p>
                  <Button onClick={startGame}>
                    <PlayIcon />
                    Start quiz
                  </Button>
                </div>
              ) : authChecked ? (
                <div className="mt-6">
                  <AccountAuthForm
                    role="student"
                    title="Student sign-in"
                    subtitle="Create a light student account so your score appears on the class leaderboard under your display name."
                    onAuthenticated={setStudent}
                  />
                </div>
              ) : (
                <p className="mt-6 text-sm text-[var(--text-secondary)]">
                  Checking account…
                </p>
              )}
            </div>
          </section>
        ) : (phase === "question" || phase === "reveal") && currentQuestion ? (
          <section aria-labelledby="active-question-heading">
            <div className="flex flex-wrap items-center justify-between gap-2 font-[family-name:var(--font-mono)] text-xs font-semibold tabular-nums">
              <span>
                Question {qIndex + 1} of {questions.length}
              </span>
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="size-4" />
                {secondsLeft}s
              </span>
            </div>

            <div className="mt-2 h-2 w-full overflow-hidden rounded-[var(--rounded-xs)] bg-[var(--border-hairline)]">
              <div
                style={{
                  width: `${Math.max(
                    0,
                    (secondsLeft / currentQuestion.timeLimitSec) * 100,
                  )}%`,
                }}
                className="h-full bg-[var(--accent-primary)] transition-[width] duration-700 ease-linear"
              />
            </div>

            <div className="mt-5 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
              <h2
                id="active-question-heading"
                className="text-xl font-bold leading-snug tracking-[-0.01em] sm:text-2xl"
              >
                {currentQuestion.prompt}
              </h2>
              {currentQuestion.scenarioNote ? (
                <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                  {currentQuestion.scenarioNote}
                </p>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {currentQuestion.choices.map((choice) => {
                const isPicked = selectedChoiceId === choice.id;
                const dimmed = phase === "reveal" && !isPicked;

                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={phase === "reveal"}
                    onClick={() => chooseAnswer(choice)}
                    className={`flex min-h-[76px] items-center gap-3.5 rounded-[var(--rounded-xs)] border-2 px-4 py-4 text-left text-base font-semibold transition-colors ${CHOICE_BUTTON_CLASS[choice.shape]} ${
                      isPicked
                        ? "border-[var(--text-primary)]"
                        : "border-[var(--border-hairline)]"
                    } ${dimmed ? "opacity-40" : ""}`}
                  >
                    <ChoiceShapeMark
                      shape={choice.shape}
                      className="size-6 shrink-0"
                    />
                    <span className="leading-snug">{choice.text}</span>
                  </button>
                );
              })}
            </div>

            {phase === "reveal" ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
                <div className="max-w-[56ch]">
                  <p className="font-[family-name:var(--font-mono)] text-sm font-semibold">
                    {selectedChoiceId === "__timeout__"
                      ? "Time up — answer locked"
                      : "Answer locked"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                    Your grade is calculated on the server when you finish.
                  </p>
                  {submitError ? (
                    <p className="mt-2 text-sm font-medium text-[var(--status-failed)]">
                      {submitError}
                    </p>
                  ) : null}
                </div>

                <Button
                  onClick={advanceQuestion}
                  disabled={submitting}
                >
                  {qIndex + 1 < questions.length
                    ? "Next question"
                    : submitting
                      ? "Submitting…"
                      : "See final grade"}
                </Button>
              </div>
            ) : null}
          </section>
        ) : finalEntry ? (
          <section aria-labelledby="summary-heading" className="grid gap-6">
            <div className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1
                    id="summary-heading"
                    className="text-2xl font-bold tracking-[-0.02em]"
                  >
                    Well played, {finalEntry.studentName}
                  </h1>
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                    {finalEntry.correctCount} of {finalEntry.totalQuestions}{" "}
                    correct · {finalEntry.scorePoints} pts ·{" "}
                    {finalEntry.durationSec}s
                  </p>
                </div>
                <GradePill grade={finalEntry.gradeFiveScale} showLabel />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPhase("lobby");
                  }}
                >
                  Play again
                </Button>
                <Link
                  href={`/lessons?lesson=${lesson.id}`}
                  className={buttonClasses({ variant: "ghost" })}
                >
                  Back to teacher studio
                </Link>
              </div>
            </div>

            <div className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
              <div className="flex items-center gap-2">
                <TrophyIcon />
                <h2 className="text-base font-semibold">Class leaderboard</h2>
              </div>
              <ol className="mt-3 divide-y divide-[var(--border-hairline)]">
                {lesson.leaderboard.slice(0, 8).map((row, idx) => (
                  <li
                    key={row.id}
                    className={`flex items-center justify-between gap-3 py-2.5 text-sm ${
                      row.id === finalEntry.id ? "font-bold" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                        {idx + 1}
                      </span>
                      <span>{row.studentName}</span>
                      {row.isSample ? (
                        <span className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs font-normal text-[var(--text-secondary)]">
                          Sample
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums">
                        {row.scorePoints} pts
                      </span>
                      <GradePill grade={row.gradeFiveScale} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
};

export default StudentQuizPlayPage;
