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
import { PlayIcon } from "@/components/lessons/lesson-icons";
import { QuizPlayer } from "@/components/quiz";
import type { LessonWorkspace, QuizLeaderboardEntry } from "@/lib/lesson-studio";
import type { QuizItem, QuizResponse, QuizResult, QuizReveal } from "@/lib/quiz";

const THEME_STORAGE_KEY = "oku-theme";

const HOMEWORK_CONFIG = {
  timed: false,
  showResultLive: true,
  showExplanation: true,
  speedBonus: false,
  showSummary: true,
} as const;

const StudentHomeworkPlayPage = (): ReactElement => {
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
    if (attr === "dark" || attr === "light") setTheme(attr);
  }, []);

  const toggleTheme = (): void => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!active) return;
        if (res.ok) {
          const data = (await res.json()) as { user?: AuthUser };
          if (data.user?.role === "student") setStudent(data.user);
        }
      } finally {
        if (active) setAuthChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(
          `/api/lessons/share/${encodeURIComponent(shareCode)}?placement=homework`,
        );
        if (res.ok && active) {
          const data = (await res.json()) as {
            lesson?: LessonWorkspace;
            questions?: QuizItem[];
          };
          if (data.lesson) setLesson(data.lesson);
          if (data.questions) setQuestions(data.questions);
          else if (data.lesson) setQuestions(data.lesson.homework);
        }
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [shareCode]);

  const onSubmitItem = async (
    response: QuizResponse,
  ): Promise<QuizReveal | null> => {
    const res = await fetch(
      `/api/lessons/share/${encodeURIComponent(shareCode)}/attempts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placement: "homework", reveal: response }),
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
            placement: "homework",
            answers: result.items.map((item) => item.response),
          }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        entry?: QuizLeaderboardEntry;
      };
      if (!res.ok || !data.entry) {
        setSubmitError(data.error ?? "Could not submit homework");
        return;
      }
      setFinalEntry(data.entry);
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
          <p className="truncate text-sm font-medium">Homework</p>
        </div>
        <Button variant="rail" size="sm" onClick={toggleTheme}>
          {theme === "light" ? <MoonIcon /> : <SunIcon />}
          {theme === "light" ? "Night" : "Day"}
        </Button>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {!loaded ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : !lesson || questions.length === 0 ? (
          <section className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <h1 className="text-2xl font-bold">No homework quiz</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              This lesson has no homework questions yet.
            </p>
            <Link href={`/play/${shareCode}`} className="mt-4 inline-block underline">
              Back to live quiz
            </Link>
          </section>
        ) : !authChecked ? (
          <p className="text-sm text-[var(--text-secondary)]">Checking account…</p>
        ) : !student ? (
          <AccountAuthForm
            role="student"
            title="Student sign-in"
            subtitle="Sign in to save your homework attempt."
            onAuthenticated={setStudent}
          />
        ) : finalEntry && !playing ? (
          <section className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <h1 className="text-2xl font-bold">Homework complete</h1>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <GradePill grade={finalEntry.gradeFiveScale} />
              <p className="font-[family-name:var(--font-mono)] text-sm tabular-nums">
                {finalEntry.correctCount}/{finalEntry.totalQuestions} correct
              </p>
            </div>
            <Button
              className="mt-5"
              onClick={() => {
                setFinalEntry(null);
                setPlaying(true);
              }}
            >
              <PlayIcon /> Try again
            </Button>
          </section>
        ) : playing ? (
          <div>
            {submitError ? (
              <p className="mb-3 text-sm text-[var(--grade-two)]">{submitError}</p>
            ) : null}
            <QuizPlayer
              questions={questions}
              config={HOMEWORK_CONFIG}
              onSubmitItem={onSubmitItem}
              onComplete={(result) => {
                void onComplete(result);
              }}
            />
          </div>
        ) : (
          <section className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <h1 className="text-2xl font-bold">{lesson.title}</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {questions.length} practice questions · untimed · explain your
              work
            </p>
            <Button className="mt-5" onClick={() => setPlaying(true)}>
              <PlayIcon /> Start homework
            </Button>
          </section>
        )}
      </main>
    </div>
  );
};

export default StudentHomeworkPlayPage;
