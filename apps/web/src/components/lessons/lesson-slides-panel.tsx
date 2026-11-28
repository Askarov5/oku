"use client";

import {
  Button,
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
  fieldClass,
} from "@oku/ui";
import Link from "next/link";
import type { ChangeEvent, ReactElement } from "react";
import { useRef, useState } from "react";
import {
  ExternalLinkIcon,
  FullscreenIcon,
  PlusIcon,
  UploadIcon,
} from "@/components/lessons/lesson-icons";
import { QrMatrix } from "@/components/lessons/qr-matrix";
import type { LessonSlide } from "@/lib/lesson-studio";

interface LessonSlidesPanelProps {
  slides: LessonSlide[];
  shareCode: string;
  readOnly?: boolean;
  dirty?: boolean;
  saving?: boolean;
  justSaved?: boolean;
  onChangeSlides: (slides: LessonSlide[]) => void;
  onSave?: () => void;
  onStartTeaching: (startIndex: number) => void;
}

const readImageDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsDataURL(file);
  });

export const LessonSlidesPanel = ({
  slides,
  shareCode,
  readOnly = false,
  dirty = false,
  saving = false,
  justSaved = false,
  onChangeSlides,
  onSave,
  onStartTeaching,
}: LessonSlidesPanelProps): ReactElement => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const canSave = Boolean(onSave) && !readOnly && dirty && !saving;
  const saveLabel = saving
    ? "Saving…"
    : justSaved && !dirty
      ? "Saved"
      : "Save slides";

  const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, slides.length - 1));
  const activeSlide = slides[safeIndex] ?? null;

  const updateSlide = (patch: Partial<LessonSlide>): void => {
    if (!activeSlide) return;
    onChangeSlides(
      slides.map((slide, idx) =>
        idx === safeIndex ? { ...slide, ...patch } : slide,
      ),
    );
  };

  const moveSlide = (direction: -1 | 1): void => {
    const target = safeIndex + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [moved] = next.splice(safeIndex, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    onChangeSlides(next);
    setSelectedIndex(target);
  };

  const deleteSlide = (index: number): void => {
    if (slides.length <= 1) return;
    const next = slides.filter((_, idx) => idx !== index);
    onChangeSlides(next);
    setSelectedIndex(Math.min(safeIndex, next.length - 1));
  };

  const addBlankSlide = (): void => {
    const created: LessonSlide = {
      id: `slide-custom-${Date.now()}`,
      kind: "concept",
      lessonNumber: 1,
      title: "Custom Teaching Slide",
      bullets: [
        "Key point or local example for your class",
        "Prompt students to compare with textbook notes",
      ],
      formulaOrCallout: null,
      pageRef: null,
      imageUrl: null,
      imageCaption: null,
      speakerNotes: "Add any personal talking cue here.",
    };
    const insertAt =
      slides[slides.length - 1]?.kind === "quiz_launch"
        ? slides.length - 1
        : slides.length;
    const next = [...slides];
    next.splice(insertAt, 0, created);
    onChangeSlides(next);
    setSelectedIndex(insertAt);
  };

  const uploadSlideFiles = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const uploaded: LessonSlide[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const imageUrl = isImage ? await readImageDataUrl(file) : null;
      uploaded.push({
        id: `slide-up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: "uploaded_media",
        lessonNumber: 1,
        title: file.name.replace(/\.[^.]+$/, ""),
        bullets: isImage
          ? ["Teacher-uploaded diagram / slide"]
          : [`Uploaded slide deck: ${file.name}`],
        formulaOrCallout: null,
        pageRef: null,
        imageUrl,
        imageCaption: file.name,
        speakerNotes: "Explain this uploaded visual before advancing.",
      });
    }

    const insertAt =
      slides[slides.length - 1]?.kind === "quiz_launch"
        ? slides.length - 1
        : slides.length;
    const next = [...slides];
    next.splice(insertAt, 0, ...uploaded);
    onChangeSlides(next);
    setSelectedIndex(insertAt);
    event.target.value = "";
  };

  const sharePath = `/play/${shareCode}`;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Filmstrip: a sideways scroller on a phone, a column beside the stage on a wide screen. */}
      <div className="order-2 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] lg:order-1">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] p-3">
          <input
            ref={uploadRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={(event) => void uploadSlideFiles(event)}
            className="sr-only"
          />
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={readOnly}
            onClick={() => uploadRef.current?.click()}
          >
            <UploadIcon />
            Upload slide
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Add blank slide"
            title="Add blank slide"
            disabled={readOnly}
            onClick={addBlankSlide}
          >
            <PlusIcon />
          </Button>
        </div>

        <ol className="flex snap-x snap-mandatory overflow-x-auto lg:block lg:snap-none lg:divide-y lg:divide-[var(--border-hairline)] lg:overflow-visible">
          {slides.map((slide, idx) => {
            const active = idx === safeIndex;
            return (
              <li
                key={slide.id}
                className="w-[min(12.5rem,72%)] shrink-0 snap-start border-r border-[var(--border-hairline)] last:border-r-0 lg:w-auto lg:border-r-0"
              >
                <button
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`flex min-h-11 w-full items-start gap-2.5 px-3 py-3 text-left text-sm transition-colors ${
                    active
                      ? "bg-[var(--bg-hover)] font-semibold text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="w-5 shrink-0 font-[family-name:var(--font-mono)] text-xs tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block leading-snug">
                      {slide.title}
                    </span>
                    <span className="mt-1 block font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                      {slide.kind === "quiz_launch"
                        ? "Quiz launch"
                        : slide.kind === "uploaded_media"
                          ? "Uploaded"
                          : slide.pageRef ?? "AI slide"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Right Workspace: 16:9 Classroom Stage Preview + Inline Slide Editor */}
      {activeSlide ? (
        <div className="order-1 grid gap-5 lg:order-2">
          {/* 16:9 Atlas Slide Canvas */}
          <div className="flex flex-col justify-between border border-[var(--border-hairline)] border-t-4 border-t-[var(--accent-primary)] bg-[var(--bg-surface)] p-6 sm:aspect-video sm:p-9">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
              <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                Slide {safeIndex + 1} of {slides.length}
                {activeSlide.pageRef ? ` · ${activeSlide.pageRef}` : ""}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move slide up"
                  disabled={readOnly || safeIndex === 0}
                  onClick={() => moveSlide(-1)}
                >
                  <ChevronUpIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move slide down"
                  disabled={readOnly || safeIndex === slides.length - 1}
                  onClick={() => moveSlide(1)}
                >
                  <ChevronDownIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete slide"
                  disabled={readOnly || slides.length <= 1}
                  onClick={() => deleteSlide(safeIndex)}
                >
                  <TrashIcon />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onStartTeaching(safeIndex)}
                >
                  <FullscreenIcon />
                  Present from here
                </Button>
              </div>
            </div>

            {activeSlide.kind === "quiz_launch" ? (
              <div className="my-auto grid items-center gap-6 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <h3 className="text-2xl font-bold tracking-[-0.02em]">
                    {activeSlide.title}
                  </h3>
                  <ul className="mt-4 space-y-2 text-base leading-7">
                    {activeSlide.bullets
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
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <code className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm font-semibold">
                      {sharePath}
                    </code>
                    <Link
                      href={sharePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--rounded-xs)] bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-primary-hover)]"
                    >
                      <ExternalLinkIcon />
                      Open student quiz
                    </Link>
                  </div>
                </div>
                <QrMatrix value={sharePath} sizeClass="size-40" />
              </div>
            ) : (
              <div className="my-auto flex flex-1 flex-col justify-between py-4">
                <div>
                  <h3 className="text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
                    {activeSlide.title}
                  </h3>

                  {activeSlide.imageUrl ? (
                    <figure className="mt-5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeSlide.imageUrl}
                        alt={activeSlide.imageCaption ?? activeSlide.title}
                        className="max-h-60 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] object-contain"
                      />
                      {activeSlide.imageCaption ? (
                        <figcaption className="mt-2 text-xs text-[var(--text-secondary)]">
                          {activeSlide.imageCaption}
                        </figcaption>
                      ) : null}
                    </figure>
                  ) : null}

                  <ul className="mt-5 max-w-[65ch] space-y-3 text-base leading-7 sm:text-lg">
                    {activeSlide.bullets
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
                </div>

                {activeSlide.formulaOrCallout ? (
                  <div className="mt-6 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 font-[family-name:var(--font-mono)] text-sm font-medium">
                    {activeSlide.formulaOrCallout}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Inline Slide Content & Speaker Notes Editor */}
          <div className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-semibold">
                Edit slide &amp; speaker notes
              </h4>
              {onSave ? (
                <Button
                  variant={dirty ? "primary" : "secondary"}
                  size="sm"
                  disabled={!canSave}
                  onClick={onSave}
                >
                  {saveLabel}
                </Button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="slide-title-input"
                  className="block text-xs font-medium text-[var(--text-secondary)]"
                >
                  Slide heading
                </label>
                <input
                  id="slide-title-input"
                  type="text"
                  value={activeSlide.title}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateSlide({ title: event.target.value })
                  }
                  className={`${fieldClass} mt-1`}
                />
              </div>

              <div>
                <label
                  htmlFor="slide-bullets-input"
                  className="block text-xs font-medium text-[var(--text-secondary)]"
                >
                  Key points (one per line)
                </label>
                <textarea
                  id="slide-bullets-input"
                  rows={Math.max(5, activeSlide.bullets.length + 2)}
                  value={activeSlide.bullets.join("\n")}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateSlide({
                      bullets: event.target.value.split("\n"),
                    })
                  }
                  className={`${fieldClass} mt-1 leading-6`}
                />
              </div>

              <div>
                <label
                  htmlFor="slide-notes-input"
                  className="block text-xs font-medium text-[var(--text-secondary)]"
                >
                  Teacher speaker notes (hidden from students)
                </label>
                <textarea
                  id="slide-notes-input"
                  rows={Math.max(5, activeSlide.bullets.length + 2)}
                  value={activeSlide.speakerNotes}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateSlide({ speakerNotes: event.target.value })
                  }
                  className={`${fieldClass} mt-1 leading-6`}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
