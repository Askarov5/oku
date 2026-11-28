"use client";

import { Button } from "@oku/ui";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";
import { ChoiceShapeMark } from "@/components/lessons/lesson-icons";
import { QrMatrix } from "@/components/lessons/qr-matrix";
import type { LessonWorkspace } from "@/lib/lesson-studio";

interface LessonPreviewViewProps {
  workspace: LessonWorkspace;
  onBackToPlan: () => void;
  onOpenStudio: () => void;
  toolbar?: ReactNode;
}

export const LessonPreviewView = ({
  workspace,
  onBackToPlan,
  onOpenStudio,
  toolbar,
}: LessonPreviewViewProps): ReactElement => {
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = workspace.slides ?? [];
  const questions = workspace.questions ?? [];
  const homework = workspace.homework ?? [];
  const safeIndex = Math.min(
    Math.max(0, slideIndex),
    Math.max(0, slides.length - 1),
  );
  const activeSlide = slides[safeIndex] ?? null;
  const sharePath = `/play/${workspace.shareCode}`;

  return (
    <div className="grid gap-8">
      <header className="border-b border-[var(--border-hairline)] pb-4">
        <button
          type="button"
          onClick={onBackToPlan}
          className="inline-flex min-h-11 items-center text-sm text-[var(--text-secondary)] hover:text-[var(--accent-ink)]"
        >
          Back to plan
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 sm:flex-1">
            <h2 className="text-balance text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
              {workspace.title}
            </h2>
            <p className="mt-2 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
              {slides.length} slides · {questions.length} questions ·{" "}
              {homework.length} homework
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:max-w-xl sm:justify-end">
            {toolbar}
            <Button size="sm" onClick={onOpenStudio}>
              Open teaching studio
            </Button>
          </div>
        </div>
      </header>

      {slides.length > 0 ? (
        <section aria-labelledby="preview-slides-heading" className="grid gap-4">
          <h3 id="preview-slides-heading" className="text-lg font-semibold">
            Slides
          </h3>
          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <ol className="order-2 flex snap-x snap-mandatory overflow-x-auto rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] lg:order-1 lg:block lg:max-h-[28rem] lg:self-start lg:snap-none lg:overflow-y-auto">
              {slides.map((slide, idx) => {
                const active = idx === safeIndex;
                return (
                  <li
                    key={slide.id}
                    className={`w-[min(12.5rem,72%)] shrink-0 snap-start border-r border-[var(--border-hairline)] last:border-r-0 lg:w-auto lg:border-r-0 ${
                      idx > 0 ? "lg:border-t" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSlideIndex(idx)}
                      className={`flex min-h-11 w-full items-start gap-2.5 px-3 py-3 text-left text-sm ${
                        active
                          ? "bg-[var(--bg-hover)] font-semibold"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <span className="w-5 shrink-0 font-[family-name:var(--font-mono)] text-xs tabular-nums">
                        {idx + 1}
                      </span>
                      <span className="line-clamp-2 leading-snug">
                        {slide.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {activeSlide ? (
              <div className="order-1 flex flex-col border border-[var(--border-hairline)] border-t-4 border-t-[var(--accent-primary)] bg-[var(--bg-surface)] p-5 sm:p-8 lg:order-2">
                <p className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                  Slide {safeIndex + 1} of {slides.length}
                </p>

                {activeSlide.kind === "quiz_launch" ? (
                  <div className="my-auto grid items-center gap-6 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div>
                      <h4 className="text-2xl font-bold tracking-[-0.02em]">
                        {activeSlide.title}
                      </h4>
                      <ul className="mt-4 space-y-2 text-base leading-7">
                        {(activeSlide.bullets ?? [])
                          .filter((line) => line.trim().length > 0)
                          .map((line, i) => (
                            <li key={i} className="flex items-baseline gap-2.5">
                              <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--accent-ink)]">
                                —
                              </span>
                              <span>{line}</span>
                            </li>
                          ))}
                      </ul>
                      <code className="mt-5 inline-block rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm font-semibold">
                        {sharePath}
                      </code>
                    </div>
                    <QrMatrix value={sharePath} sizeClass="size-36" />
                  </div>
                ) : (
                  <div className="my-auto py-4">
                    <h4 className="text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
                      {activeSlide.title}
                    </h4>
                    {activeSlide.imageUrl ? (
                      <figure className="mt-5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeSlide.imageUrl}
                          alt={activeSlide.imageCaption ?? activeSlide.title}
                          className="max-h-52 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] object-contain"
                        />
                      </figure>
                    ) : null}
                    <ul className="mt-5 max-w-[65ch] space-y-3 text-base leading-7">
                      {(activeSlide.bullets ?? [])
                        .filter((point) => point.trim().length > 0)
                        .map((point, idx) => (
                          <li key={idx} className="flex items-baseline gap-3">
                            <span className="font-[family-name:var(--font-mono)] text-sm font-semibold text-[var(--accent-ink)]">
                              {idx + 1}.
                            </span>
                            <span>{point}</span>
                          </li>
                        ))}
                    </ul>
                    {activeSlide.formulaOrCallout ? (
                      <p className="mt-5 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 font-[family-name:var(--font-mono)] text-sm">
                        {activeSlide.formulaOrCallout}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {questions.length > 0 ? (
        <section aria-labelledby="preview-quiz-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 id="preview-quiz-heading" className="text-lg font-semibold">
              Student quiz
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Student link{" "}
              <Link
                href={sharePath}
                className="font-[family-name:var(--font-mono)] text-[var(--accent-ink)] underline-offset-2 hover:underline"
              >
                {sharePath}
              </Link>
            </p>
          </div>
          <ol className="mt-4 divide-y divide-[var(--border-hairline)] rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
            {questions.map((question, idx) => {
              const choices =
                question.kind === "multiple_choice" ||
                question.kind === "checkboxes"
                  ? (question.choices ?? [])
                  : [];
              return (
                <li key={question.id} className="p-5">
                  <p className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                    Q{idx + 1} · {question.kind} · {question.timeLimitSec}s ·{" "}
                    {question.points} pts
                  </p>
                  <p className="mt-1.5 text-base font-semibold leading-snug">
                    {question.prompt}
                  </p>
                  {choices.length > 0 ? (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {choices.map((choice) => {
                        const isCorrect =
                          question.kind === "multiple_choice"
                            ? question.answer?.correctChoiceId === choice.id
                            : question.kind === "checkboxes"
                              ? (
                                  question.answer?.correctChoiceIds ?? []
                                ).includes(choice.id)
                              : false;
                        return (
                          <li
                            key={choice.id}
                            className={`flex items-start gap-2.5 rounded-[var(--rounded-xs)] border px-3 py-2.5 text-sm ${
                              isCorrect
                                ? "border-[var(--accent-primary)] bg-[var(--bg-hover)]"
                                : "border-[var(--border-hairline)]"
                            }`}
                          >
                            {choice.shape ? (
                              <ChoiceShapeMark
                                shape={choice.shape}
                                className="mt-0.5 size-4 shrink-0"
                              />
                            ) : null}
                            <span>
                              {choice.text}
                              {isCorrect ? (
                                <span className="ml-2 font-[family-name:var(--font-mono)] text-xs text-[var(--accent-ink)]">
                                  correct
                                </span>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      Key: {JSON.stringify(question.answer ?? null)}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {homework.length > 0 ? (
        <section aria-labelledby="preview-homework-heading">
          <h3 id="preview-homework-heading" className="text-lg font-semibold">
            Homework
          </h3>
          <ol className="mt-4 divide-y divide-[var(--border-hairline)] rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
            {homework.map((item, idx) => (
              <li key={item.id} className="p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-base font-semibold">
                    {idx + 1}. {item.kind}
                  </h4>
                  <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                    {item.requireExplanation ? "explain · " : ""}
                    {item.points} pts
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6">{item.prompt}</p>
                {item.explanation ? (
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--text-primary)]">
                      Explanation:{" "}
                    </span>
                    {item.explanation}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] pt-4">
        <Button size="sm" onClick={onOpenStudio}>
          Open teaching studio
        </Button>
        <Button variant="secondary" size="sm" onClick={onBackToPlan}>
          Back to plan
        </Button>
      </div>
    </div>
  );
};
