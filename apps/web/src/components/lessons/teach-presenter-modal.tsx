"use client";

import {
  Button,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  buttonClasses,
} from "@oku/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ClockIcon,
  ExternalLinkIcon,
} from "@/components/lessons/lesson-icons";
import { QrMatrix } from "@/components/lessons/qr-matrix";
import type { LessonSlide } from "@/lib/lesson-studio";

interface TeachPresenterModalProps {
  open: boolean;
  lessonTitle: string;
  minutesPerLesson: number;
  slides: LessonSlide[];
  initialIndex: number;
  shareCode: string;
  leaderboardCount: number;
  onClose: () => void;
}

const formatClock = (secondsLeft: number): string => {
  const safe = Math.max(0, secondsLeft);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export const TeachPresenterModal = ({
  open,
  lessonTitle,
  minutesPerLesson,
  slides,
  initialIndex,
  shareCode,
  leaderboardCount,
  onClose,
}: TeachPresenterModalProps): ReactElement | null => {
  const [index, setIndex] = useState(initialIndex);
  const [showNotes, setShowNotes] = useState(true);
  const [running, setRunning] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(minutesPerLesson * 60);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, open]);

  useEffect(() => {
    setSecondsLeft(minutesPerLesson * 60);
  }, [minutesPerLesson, open]);

  useEffect(() => {
    if (!open || !running) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, running]);

  useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = dialogRef.current;
    const focusable = (): HTMLElement[] =>
      root
        ? [
            ...root.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ]
        : [];
    focusable()[0]?.focus();

    const trapTab = (event: KeyboardEvent): void => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", trapTab);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", trapTab);
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight") {
        setIndex((prev) => Math.min(slides.length - 1, prev + 1));
      } else if (event.key === "ArrowLeft") {
        setIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, slides.length, onClose]);

  if (!open || slides.length === 0) {
    return null;
  }

  const slide = slides[Math.min(index, slides.length - 1)]!;
  const sharePath = `/play/${shareCode}`;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Teaching presenter — ${lessonTitle}`}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]"
    >
      {/* Top Classroom Bar */}
      <header
        data-surface="rail"
        className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-[var(--accent-primary)] bg-[var(--bg-rail)] px-4 py-3 text-[var(--text-on-rail)] sm:px-8"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-lg font-bold tracking-[-0.02em]">oku</span>
          <span aria-hidden className="h-4 w-px bg-[var(--rail-line)]" />
          <p className="truncate text-sm font-medium">{lessonTitle}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setRunning((prev) => !prev)}
            title={running ? "Pause class timer" : "Resume class timer"}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--rounded-xs)] border border-[var(--rail-line)] px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs font-semibold tabular-nums text-[var(--text-on-rail)] hover:bg-[var(--rail-hover)]"
          >
            <ClockIcon className="size-4" />
            {formatClock(secondsLeft)} {running ? "" : "· paused"}
          </button>

          <Button
            variant="rail"
            size="sm"
            onClick={() => setShowNotes((prev) => !prev)}
          >
            {showNotes ? "Hide notes" : "Speaker notes"}
          </Button>

          <Button
            variant="rail"
            size="icon"
            aria-label="Exit classroom presenter"
            onClick={onClose}
          >
            <CloseIcon />
          </Button>
        </div>
      </header>

      {/* Center Projection Stage */}
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col justify-center overflow-y-auto px-4 py-5 sm:px-10">
        <div className="oku-stage-enter flex flex-col justify-between border border-[var(--border-hairline)] border-t-4 border-t-[var(--accent-primary)] bg-[var(--bg-surface)] p-6 sm:aspect-video sm:p-10">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
            <span>
              Slide {index + 1} / {slides.length}
            </span>
            {slide.pageRef ? <span>Textbook {slide.pageRef}</span> : null}
          </div>

          {slide.kind === "quiz_launch" ? (
            <div className="my-auto grid items-center gap-8 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
                  {slide.title}
                </h2>
                <ul className="mt-5 space-y-3 text-lg leading-8">
                  {slide.bullets
                    .filter((item) => item.trim().length > 0)
                    .map((item, idx) => (
                      <li key={idx} className="flex items-baseline gap-3">
                        <span className="font-[family-name:var(--font-mono)] text-sm font-semibold text-[var(--accent-ink)]">
                          {idx + 1}.
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                </ul>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <code className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2.5 font-[family-name:var(--font-mono)] text-base font-semibold">
                    {sharePath}
                  </code>
                  <Link
                    href={sharePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses({ variant: "primary" })}
                  >
                    <ExternalLinkIcon />
                    Launch student quiz
                  </Link>
                  <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                    {leaderboardCount} results recorded
                  </span>
                </div>
              </div>

              <QrMatrix value={sharePath} sizeClass="size-48" />
            </div>
          ) : (
            <div className="my-auto flex flex-1 flex-col justify-between py-4">
              <div>
                <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
                  {slide.title}
                </h2>

                {slide.imageUrl ? (
                  <figure className="mt-5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.imageUrl}
                      alt={slide.imageCaption ?? slide.title}
                      className="max-h-64 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] object-contain"
                    />
                  </figure>
                ) : null}

                <ul className="mt-6 max-w-[65ch] space-y-4 text-xl leading-8">
                  {slide.bullets
                    .filter((point) => point.trim().length > 0)
                    .map((point, idx) => (
                      <li key={idx} className="flex items-baseline gap-3.5">
                        <span className="font-[family-name:var(--font-mono)] text-base font-semibold text-[var(--accent-ink)]">
                          {idx + 1}.
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                </ul>
              </div>

              {slide.formulaOrCallout ? (
                <div className="mt-6 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-5 py-4 font-[family-name:var(--font-mono)] text-base font-semibold">
                  {slide.formulaOrCallout}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {showNotes && slide.speakerNotes ? (
          <div className="mt-4 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-3.5 text-sm leading-6 text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">
              Speaker cue:{" "}
            </span>
            {slide.speakerNotes}
          </div>
        ) : null}
      </div>

      {/* Bottom Slide Pager */}
      <footer className="flex items-center justify-between gap-4 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3 sm:px-8">
        <Button
          variant="ghost"
          disabled={index === 0}
          onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
        >
          <ChevronLeftIcon />
          Previous slide
        </Button>

        <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
          Use Left / Right arrow keys
        </span>

        <Button
          variant={index === slides.length - 1 ? "ghost" : "primary"}
          disabled={index === slides.length - 1}
          onClick={() =>
            setIndex((prev) => Math.min(slides.length - 1, prev + 1))
          }
        >
          Next slide
          <ChevronRightIcon />
        </Button>
      </footer>
    </div>
  );
};
