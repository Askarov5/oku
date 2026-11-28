"use client";

import { Button, MoonIcon, SunIcon } from "@oku/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactElement } from "react";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  AccountAuthForm,
  type AuthUser,
} from "@/components/lessons/account-auth-form";
import { GradePill } from "@/components/lessons/grade-pill";
import { PlayIcon, TrophyIcon } from "@/components/lessons/lesson-icons";
import { QuizPlayer } from "@/components/quiz";
import type { LessonWorkspace, QuizLeaderboardEntry } from "@/lib/lesson-studio";
import type { QuizItem, QuizResponse, QuizResult, QuizReveal } from "@/lib/quiz";

const THEME_STORAGE_KEY = "oku-theme";

const LIVE_CONFIG = {
  timed: true,
  showResultLive: true,
  showExplanation: false,
  speedBonus: true,
  showSummary: true,
} as const;

const StudentQuizPlayPage = (): ReactElement => {
  const params = useParams<{ shareCode: string }>();
  const shareCode = params.shareCode;

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lesson, setLesson] = useState<LessonWorkspace | null>(null);
  const [questions, setQuestions] = useState<QuizItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [student, setStudent] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [finalEntry, setFinalEntry] = useState<QuizLeaderboardEntry | null>(
    null,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

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
          `/api/lessons/share/${encodeURIComponent(shareCode)}?placement=live`,
        );
        if (res.ok && active) {
          const data = (await res.json()) as {
            lesson?: LessonWorkspace;
            questions?: QuizItem[];
          };
          if (data.lesson) setLesson(data.lesson);
          if (data.questions) setQuestions(data.questions);
          else if (data.lesson) setQuestions(data.lesson.questions);
        }
      } catch {
        // Offline.
      } finally {
        if (active) setLoaded(true);
      }
    };
    void loadQuiz();
    return () => {
      active = false;
    };
  }, [shareCode]);

  const handleSignOut = async (): Promise<void> => {
    await fetch("/api/auth/logout", { method: "POST" });
    setStudent(null);
    setPlaying(false);
  };

  const onSubmitItem = async (
    response: QuizResponse,
  ): Promise<QuizReveal | null> => {
    const res = await fetch(
      `/api/lessons/share/${encodeURIComponent(shareCode)}/attempts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placement: "live", reveal: response }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { reveal?: QuizReveal };
    return data.reveal ?? null;
  };

  const onComplete = async (result: QuizResult): Promise<void> => {
    setSubmitError(null);
    try {
      const res = await fetch(
        `/api/lessons/share/${encodeURIComponent(shareCode)}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placement: "live",
            answers: result.items.map((item) => item.response),
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
      }
      setPlaying(false);
    } catch {
      setSubmitError("Network error while submitting");
    }
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
        {!loaded ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading quiz…</p>
        ) : !lesson || questions.length === 0 ? (
          <section className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-[-0.02em]">
              Quiz code not found
            </h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              No live quiz matched code{" "}
              <code className="font-[family-name:var(--font-mono)]">
                {shareCode}
              </code>
              .
            </p>
            <Link
              href="/play/ek-soccer-9a"
              className="mt-4 inline-flex text-sm font-medium text-[var(--accent-ink)] underline"
            >
              Try the sample quiz
            </Link>
          </section>
        ) : !authChecked ? (
          <p className="text-sm text-[var(--text-secondary)]">Checking account…</p>
        ) : !student ? (
          <AccountAuthForm
            role="student"
            title="Student sign-in"
            subtitle="Create a light student account to play and appear on the class leaderboard."
            onAuthenticated={setStudent}
          />
        ) : finalEntry && !playing ? (
          <section className="space-y-6">
            <div className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
              <div className="flex items-center gap-2">
                <TrophyIcon className="size-5" />
                <h1 className="text-2xl font-bold tracking-[-0.02em]">
                  Quiz complete
                </h1>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <GradePill grade={finalEntry.gradeFiveScale} />
                <p className="font-[family-name:var(--font-mono)] text-sm tabular-nums">
                  {finalEntry.scorePoints} pts · {finalEntry.correctCount}/
                  {finalEntry.totalQuestions} correct
                </p>
              </div>
              <Button
                className="mt-5"
                onClick={() => {
                  setFinalEntry(null);
                  setPlaying(true);
                }}
              >
                <PlayIcon /> Play again
              </Button>
            </div>
            {lesson.leaderboard.length > 0 ? (
              <div>
                <h2 className="text-lg font-semibold">Class leaderboard</h2>
                <ol className="mt-3 space-y-2">
                  {lesson.leaderboard.slice(0, 10).map((row, idx) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                          {idx + 1}.
                        </span>{" "}
                        {row.studentName}
                      </span>
                      <span className="font-[family-name:var(--font-mono)] tabular-nums">
                        {row.scorePoints}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </section>
        ) : playing ? (
          <div>
            {submitError ? (
              <p className="mb-3 text-sm text-[var(--grade-two)]">{submitError}</p>
            ) : null}
            <QuizPlayer
              questions={questions}
              config={LIVE_CONFIG}
              onSubmitItem={onSubmitItem}
              onComplete={(result) => {
                void onComplete(result);
              }}
            />
          </div>
        ) : (
          <section className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-[-0.02em]">
              {lesson.title}
            </h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {questions.length} questions · timed · speed bonus
            </p>
            <Button className="mt-5" onClick={() => setPlaying(true)}>
              <PlayIcon /> Start quiz
            </Button>
            <p className="mt-4 text-xs text-[var(--text-secondary)]">
              Homework?{" "}
              <Link
                href={`/play/${shareCode}/homework`}
                className="underline"
              >
                Open practice set
              </Link>
            </p>
          </section>
        )}
      </main>
    </div>
  );
};

export default StudentQuizPlayPage;
