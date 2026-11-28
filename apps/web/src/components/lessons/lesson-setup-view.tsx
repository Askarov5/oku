"use client";

import { Button, TrashIcon, fieldClass } from "@oku/ui";
import type { ChangeEvent, DragEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PlusIcon,
  SparklesIcon,
  UploadIcon,
} from "@/components/lessons/lesson-icons";
import { languageName } from "@/lib/catalog";
import type {
  LessonSetupDraft,
  StudioAttachment,
  StudioBookOption,
  StudioUnitOption,
} from "@/lib/lesson-studio";
import { defaultAudienceForBook } from "@/lib/lesson-studio";
import {
  emptyStudioCatalogFilters,
  filterStudioBooks,
  filterUnitsForBook,
  studioCatalogCategories,
  studioCatalogGrades,
  type StudioCatalogFilters,
} from "@/lib/studio-catalog-filter";

interface LessonSetupViewProps {
  books: StudioBookOption[];
  draft: LessonSetupDraft;
  generating: boolean;
  /** True when the page opened with a book and unit already chosen. */
  unitConfirmed?: boolean;
  onChangeDraft: (next: LessonSetupDraft) => void;
  onGeneratePlan: () => void;
}

const ANGLE_EXAMPLES: readonly string[] = [
  "Explain kinetic energy using a soccer ball, free kicks, and shot speed vs. ball weight.",
  "Use local Central Asian trade corridors and railway borders as concrete examples.",
  "Break every formula into a 3-step visual recipe for students who struggle with algebra.",
];

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

export const LessonSetupView = ({
  books,
  draft,
  generating,
  unitConfirmed = false,
  onChangeDraft,
  onGeneratePlan,
}: LessonSetupViewProps): ReactElement => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [filters, setFilters] = useState<StudioCatalogFilters>(
    emptyStudioCatalogFilters,
  );
  const [browsingBookId, setBrowsingBookId] = useState<string | null>(null);
  const [unitPicked, setUnitPicked] = useState(unitConfirmed);
  const [fieldFocused, setFieldFocused] = useState(false);

  useEffect(() => {
    if (unitConfirmed) setUnitPicked(true);
  }, [unitConfirmed]);

  const categories = useMemo(() => studioCatalogCategories(books), [books]);
  const grades = useMemo(() => studioCatalogGrades(books), [books]);
  const filteredBooks = useMemo(
    () => filterStudioBooks(books, filters),
    [books, filters],
  );

  const browsingBook =
    filteredBooks.find((item) => item.id === browsingBookId) ?? null;

  const unitHits = useMemo(
    () => (browsingBook ? filterUnitsForBook(browsingBook, filters.query) : []),
    [browsingBook, filters.query],
  );

  const activeBook =
    unitPicked
      ? (books.find((item) => item.id === draft.bookId) ?? null)
      : null;
  const activeUnit: StudioUnitOption | null =
    activeBook?.units[draft.unitIndex] ?? null;

  const selectBook = (bookId: string): void => {
    setBrowsingBookId(bookId);
    setUnitPicked(false);
  };

  const selectUnitHit = (bookId: string, unitIndex: number): void => {
    const nextBook = books.find((item) => item.id === bookId);
    if (!nextBook) return;
    onChangeDraft({
      ...draft,
      bookId: nextBook.id,
      unitIndex,
      audience: draft.audienceTouched
        ? draft.audience
        : defaultAudienceForBook(nextBook),
    });
    setBrowsingBookId(bookId);
    setUnitPicked(true);
  };

  const patchFilters = (patch: Partial<StudioCatalogFilters>): void => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const clearFilters = (): void => {
    setFilters(emptyStudioCatalogFilters());
  };

  const clearBookSelection = (): void => {
    setBrowsingBookId(null);
    setUnitPicked(false);
  };

  const toggleDeliverable = (
    key: "slides" | "kahootTest" | "homework",
  ): void => {
    onChangeDraft({
      ...draft,
      deliverables: {
        ...draft.deliverables,
        [key]: !draft.deliverables[key],
      },
    });
  };

  const ingestFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) return;

    const added: StudioAttachment[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const previewUrl = isImage ? await readFileAsDataUrl(file) : null;
      added.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        kind: isImage ? "image" : "pdf_slides",
        previewUrl,
        notesText: null,
        useInAi: true,
        includeAsSlide: isImage,
      });
    }

    onChangeDraft({
      ...draft,
      attachments: [...draft.attachments, ...added],
    });
  };

  const handleFileUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const files = Array.from(event.target.files ?? []);
    await ingestFiles(files);
    event.target.value = "";
  };

  const handleDropFiles = async (
    event: DragEvent<HTMLDivElement>,
  ): Promise<void> => {
    event.preventDefault();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    await ingestFiles(files);
  };

  const addNotesAttachment = (): void => {
    const trimmed = notesDraft.trim();
    if (!trimmed) return;
    const item: StudioAttachment = {
      id: `att-note-${Date.now()}`,
      name: `Teacher note (${trimmed.slice(0, 28)}${trimmed.length > 28 ? "…" : ""})`,
      kind: "notes",
      previewUrl: null,
      notesText: trimmed,
      useInAi: true,
      includeAsSlide: false,
    };
    onChangeDraft({
      ...draft,
      attachments: [...draft.attachments, item],
    });
    setNotesDraft("");
  };

  const removeAttachment = (id: string): void => {
    onChangeDraft({
      ...draft,
      attachments: draft.attachments.filter((item) => item.id !== id),
    });
  };

  const toggleAttachmentSlide = (id: string): void => {
    onChangeDraft({
      ...draft,
      attachments: draft.attachments.map((item) =>
        item.id === id
          ? { ...item, includeAsSlide: !item.includeAsSlide }
          : item,
      ),
    });
  };

  const planReady = unitPicked && Boolean(activeUnit);
  const planLabel = generating
    ? "Generating lesson plan…"
    : "Generate lesson plan";

  return (
    <div
      className="pb-[calc(8.25rem+env(safe-area-inset-bottom))] lg:pb-0"
      onFocusCapture={(event) => {
        const tag =
          event.target instanceof HTMLElement ? event.target.tagName : "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
          setFieldFocused(true);
        }
      }}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
          setFieldFocused(false);
        }
      }}
    >
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section
        aria-labelledby="setup-heading"
        className="lg:col-start-1 lg:row-start-1"
      >
        <h2
          id="setup-heading"
          className="text-2xl font-bold tracking-[-0.02em]"
        >
          Build a lesson from a textbook unit
        </h2>
        <p className="mt-1.5 max-w-[65ch] text-sm leading-6 text-[var(--text-secondary)]">
          Pick a unit, add your own teaching angle or uploaded visuals, review
          the generated lesson plan first, and then generate slides, a
          shareable quiz, and homework.
        </p>

        {/* 1. Searchable book & unit picker */}
        <div className="mt-6 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          <div className="grid gap-3 border-b border-[var(--border-hairline)] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-2">
              <label
                htmlFor="studio-catalog-search"
                className="block text-sm font-semibold"
              >
                Search materials
              </label>
              <input
                id="studio-catalog-search"
                type="search"
                value={filters.query}
                onChange={(event) => patchFilters({ query: event.target.value })}
                placeholder="Book title, subject, topic…"
                className={`${fieldClass} mt-1.5`}
              />
            </div>
            <div>
              <label
                htmlFor="studio-catalog-language"
                className="block text-sm font-semibold"
              >
                Language
              </label>
              <select
                id="studio-catalog-language"
                value={filters.language}
                onChange={(event) =>
                  patchFilters({
                    language: event.target.value as StudioCatalogFilters["language"],
                  })
                }
                className={`${fieldClass} mt-1.5`}
              >
                <option value="all">All</option>
                <option value="ky">Kyrgyz</option>
                <option value="ru">Russian</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="studio-catalog-grade"
                className="block text-sm font-semibold"
              >
                Grade
              </label>
              <select
                id="studio-catalog-grade"
                value={filters.grade === "all" ? "all" : String(filters.grade)}
                onChange={(event) =>
                  patchFilters({
                    grade:
                      event.target.value === "all"
                        ? "all"
                        : Number(event.target.value),
                  })
                }
                className={`${fieldClass} mt-1.5`}
              >
                <option value="all">All</option>
                {grades.map((grade) => (
                  <option key={grade} value={grade}>
                    Grade {grade}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label
                htmlFor="studio-catalog-category"
                className="block text-sm font-semibold"
              >
                Category
              </label>
              <select
                id="studio-catalog-category"
                value={filters.category}
                onChange={(event) =>
                  patchFilters({ category: event.target.value })
                }
                className={`${fieldClass} mt-1.5`}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--border-hairline)] px-4 py-1 sm:px-5">
            <p className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
              {browsingBook
                ? `${unitHits.length} unit${unitHits.length === 1 ? "" : "s"} in ${browsingBook.title}`
                : `${filteredBooks.length} book${filteredBooks.length === 1 ? "" : "s"}`}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              {browsingBook ? (
                <button
                  type="button"
                  onClick={clearBookSelection}
                  className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-[var(--text-secondary)] underline-offset-2 hover:underline"
                >
                  Change book
                </button>
              ) : null}
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-[var(--text-secondary)] underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            </div>
          </div>

          {!browsingBook ? (
            <ul className="max-h-[22rem] overflow-y-auto divide-y divide-[var(--border-hairline)]">
              {filteredBooks.length === 0 ? (
                <li className="px-5 py-8 text-sm text-[var(--text-secondary)]">
                  No books match this search. Try a different title or clear the
                  filters.
                </li>
              ) : (
                filteredBooks.map((book) => {
                  const langLabel =
                    book.language === "en"
                      ? "English"
                      : languageName(book.language);
                  return (
                    <li key={book.id}>
                      <button
                        type="button"
                        onClick={() => selectBook(book.id)}
                        className="min-h-11 w-full px-4 py-3.5 text-left transition-colors hover:bg-[var(--bg-hover)] sm:px-5"
                      >
                        <p className="text-sm font-semibold leading-snug">
                          {book.title}
                        </p>
                        <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                          {book.categoryName}
                          {book.isSchoolTextbook && book.grade !== null
                            ? ` · Grade ${book.grade}`
                            : ""}
                          {` · ${langLabel}`}
                          {` · ${book.units.length} unit${book.units.length === 1 ? "" : "s"}`}
                          {book.source === "sample" ? " · Sample" : ""}
                        </p>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto divide-y divide-[var(--border-hairline)]">
              {unitHits.length === 0 ? (
                <li className="px-5 py-8 text-sm text-[var(--text-secondary)]">
                  No units in this book match the search. Clear the query or
                  pick another book.
                </li>
              ) : (
                unitHits.map(({ book, unit, unitIndex }) => {
                  const selected =
                    unitPicked &&
                    book.id === draft.bookId &&
                    unitIndex === draft.unitIndex;
                  return (
                    <li key={unit.id}>
                      <button
                        type="button"
                        onClick={() => selectUnitHit(book.id, unitIndex)}
                        className={`min-h-11 w-full px-4 py-3.5 text-left transition-colors sm:px-5 ${
                          selected
                            ? "bg-[var(--bg-hover)]"
                            : "hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug">
                            {unit.title}
                          </p>
                          <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                            {unit.pageRangeLabel}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
                          {unit.summary}
                        </p>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          )}

          {activeBook && activeUnit ? (
            <div className="border-t border-[var(--border-hairline)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-secondary)]">
                Selected unit
              </p>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold">{activeUnit.title}</h3>
                <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
                  {activeUnit.pageRangeLabel}
                  {activeBook.source === "library"
                    ? " · Digitized library"
                    : " · Sample unit"}
                </span>
              </div>
              <p className="mt-1.5 max-w-[65ch] text-sm leading-6 text-[var(--text-secondary)]">
                {activeUnit.summary}
              </p>
              {activeUnit.keyTerms.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeUnit.keyTerms.map((term) => (
                    <span
                      key={term}
                      className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                    >
                      {term}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className="order-3 grid gap-8 lg:order-none lg:col-start-1 lg:row-start-2">
        {/* 2. Teacher's Creative Angle / Analogy */}
        <div>
          <label
            htmlFor="creative-angle"
            className="block text-lg font-semibold tracking-[-0.01em]"
          >
            Teaching angle or real-world analogy
          </label>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Tell AI how to frame the explanation so students connect with it
            immediately—for instance, explaining kinetic energy through soccer
            free kicks.
          </p>
          <textarea
            id="creative-angle"
            rows={3}
            value={draft.creativeAngle}
            onChange={(event) =>
              onChangeDraft({ ...draft, creativeAngle: event.target.value })
            }
            placeholder="e.g., Explain kinetic energy using a soccer ball and free kicks so students see why doubling shot speed quadruples energy…"
            className={`${fieldClass} mt-3 bg-[var(--bg-surface)] leading-6`}
          />
          <div className="mt-2.5 flex flex-wrap gap-2">
            {ANGLE_EXAMPLES.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() =>
                  onChangeDraft({ ...draft, creativeAngle: prompt })
                }
                className="min-h-11 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-control)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Bring Your Own Materials (Upload images, slides, or NotebookLM notes) */}
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.01em]">
            Bring your own materials
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Drop diagrams, slide images, or PDFs below, or attach external study
            notes (such as NotebookLM summaries) to weave into the lesson.
          </p>

          <div className="mt-3 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(event) => void handleFileUpload(event)}
              className="sr-only"
            />

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => void handleDropFiles(event)}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-[var(--rounded-xs)] border border-dashed px-4 py-3.5 transition-colors ${
                dragActive
                  ? "border-[var(--accent-primary)] bg-[var(--bg-hover)]"
                  : "border-[var(--border-control)] bg-[var(--bg-canvas)]"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Drop slide images or PDFs here
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  PNG, JPG, WebP, or PDF — inserted into slides or used as AI
                  grounding
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon />
                Browse files
              </Button>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                aria-label="Paste external note or link"
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addNotesAttachment();
                  }
                }}
                placeholder="Paste notes or reference link…"
                className={fieldClass}
              />
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                disabled={!notesDraft.trim()}
                onClick={addNotesAttachment}
              >
                <PlusIcon />
                Attach note
              </Button>
            </div>

            {draft.attachments.length > 0 ? (
              <ul className="mt-4 divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
                {draft.attachments.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-3 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {item.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="h-10 w-14 shrink-0 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] object-cover"
                        />
                      ) : (
                        <span className="inline-flex h-10 w-14 shrink-0 items-center justify-center rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                          {item.kind === "pdf_slides" ? "PDF" : "NOTE"}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.name}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {item.kind === "image"
                            ? "Image · Grounded in AI & slide deck"
                            : item.kind === "pdf_slides"
                              ? "Slide document · Grounded in AI"
                              : item.notesText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {item.previewUrl ? (
                        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
                          <input
                            type="checkbox"
                            checked={item.includeAsSlide}
                            onChange={() => toggleAttachmentSlide(item.id)}
                            className="size-6 rounded-[var(--rounded-xs)]"
                          />
                          Insert as slide
                        </label>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => removeAttachment(item.id)}
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      {/* Lesson settings sit beside the source on a wide screen, and directly under the unit picker on a phone. */}
      <aside
        aria-labelledby="params-heading"
        className="order-2 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 sm:p-5 lg:sticky lg:top-6 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <h3 id="params-heading" className="text-lg font-semibold">
          Lesson settings
        </h3>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
          Defaults adapt automatically to the selected textbook.
        </p>

        <div className="mt-5 grid gap-4">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="audience-input"
                className="text-sm font-semibold"
              >
                Audience
              </label>
              {activeBook?.isSchoolTextbook && activeBook.grade !== null ? (
                <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                  from Grade {activeBook.grade} book
                </span>
              ) : null}
            </div>
            <input
              id="audience-input"
              type="text"
              value={draft.audience}
              onChange={(event) =>
                onChangeDraft({
                  ...draft,
                  audience: event.target.value,
                  audienceTouched: true,
                })
              }
              className={`${fieldClass} mt-1.5`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="amount-lessons-input"
                className="block text-sm font-semibold"
              >
                Lessons
              </label>
              <input
                id="amount-lessons-input"
                type="number"
                min={1}
                max={6}
                value={draft.amountOfLessons}
                onChange={(event) =>
                  onChangeDraft({
                    ...draft,
                    amountOfLessons: Math.min(
                      6,
                      Math.max(1, Number(event.target.value) || 1),
                    ),
                  })
                }
                className={`${fieldClass} mt-1.5 font-[family-name:var(--font-mono)] tabular-nums`}
              />
            </div>

            <div>
              <label
                htmlFor="minutes-per-lesson-input"
                className="block text-sm font-semibold"
              >
                Min / lesson
              </label>
              <input
                id="minutes-per-lesson-input"
                type="number"
                min={15}
                max={180}
                step={5}
                value={draft.minutesPerLesson}
                onChange={(event) =>
                  onChangeDraft({
                    ...draft,
                    minutesPerLesson: Math.min(
                      180,
                      Math.max(15, Number(event.target.value) || 45),
                    ),
                  })
                }
                className={`${fieldClass} mt-1.5 font-[family-name:var(--font-mono)] tabular-nums`}
              />
            </div>
          </div>

          <fieldset className="mt-2 border-t border-[var(--border-hairline)] pt-4">
            <legend className="text-sm font-semibold">
              Materials to generate after plan review
            </legend>
            <div className="mt-3 flex flex-col gap-3">
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={draft.deliverables.slides}
                  onChange={() => toggleDeliverable("slides")}
                  className="mt-0.5 size-6 shrink-0 rounded-[var(--rounded-xs)]"
                />
                <span>
                  <span className="block font-medium">Generate slides</span>
                  <span className="block text-xs text-[var(--text-secondary)]">
                    16:9 classroom deck mixed with your uploaded images
                  </span>
                </span>
              </label>

              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={draft.deliverables.kahootTest}
                  onChange={() => toggleDeliverable("kahootTest")}
                  className="mt-0.5 size-6 shrink-0 rounded-[var(--rounded-xs)]"
                />
                <span>
                  <span className="block font-medium">
                    Generate quiz
                  </span>
                  <span className="block text-xs text-[var(--text-secondary)]">
                    Shareable link &amp; QR, timed questions, auto-graded 2–5
                  </span>
                </span>
              </label>

              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={draft.deliverables.homework}
                  onChange={() => toggleDeliverable("homework")}
                  className="mt-0.5 size-6 shrink-0 rounded-[var(--rounded-xs)]"
                />
                <span>
                  <span className="block font-medium">Generate homework</span>
                  <span className="block text-xs text-[var(--text-secondary)]">
                    Practice problems + teacher answer guide
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          {!planReady && !generating ? (
            <p className="mt-3 text-sm leading-5 text-[var(--text-secondary)]">
              Choose a unit to generate the plan.
            </p>
          ) : null}

          <div className="mt-2 hidden lg:block">
            <Button
              className="w-full"
              disabled={generating || !planReady}
              aria-busy={generating}
              onClick={onGeneratePlan}
            >
              <SparklesIcon />
              {planLabel}
            </Button>
          </div>
        </div>
      </aside>
    </div>

      <div
        aria-hidden={fieldFocused}
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-150 ease-out motion-reduce:transition-none lg:hidden ${
          fieldFocused ? "pointer-events-none translate-y-full" : ""
        }`}
      >
        <p className="mb-2 truncate font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
          {activeUnit && planReady
            ? `${activeUnit.title} · ${activeUnit.pageRangeLabel}`
            : "Choose a unit to continue"}
        </p>
        <Button
          className="w-full"
          disabled={generating || !planReady}
          aria-busy={generating}
          onClick={onGeneratePlan}
        >
          <SparklesIcon />
          {planLabel}
        </Button>
      </div>
    </div>
  );
};
