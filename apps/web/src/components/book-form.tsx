"use client";

import {
  pageRoleLabel,
  parsePageRoleAssignments,
  resolvePageRoles,
} from "@oku/shared-types";
import type { SpecialPageRole } from "@oku/shared-types";
import { Button, Card, ChevronDownIcon, Notice, fieldClass } from "@oku/ui";
import type { NoticeState } from "@oku/ui";
import { cloneElement, isValidElement } from "react";
import type { FormEvent, ReactElement, ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { PdfPreview } from "@/components/pdf-preview";
import type { PdfPreviewResult } from "@/components/pdf-preview";
import type { Category, LibraryBook } from "@/lib/catalog";
import { SCHOOL_GRADES } from "@/lib/catalog";
import {
  pageInDigitizeRange,
  queuedPageCount,
  roleForPreviewPage,
} from "@/lib/book-page-range";

const FIELD = `${fieldClass} mt-1`;

interface FieldHintProps {
  /** Name of the field, used in the button’s accessible name. */
  label: string;
  /** Id of the note. The field points aria-describedby at it. */
  tooltipId: string;
  children: string;
}

/**
 * A “?” beside a label. Hover and keyboard focus open the note. A tap pins it
 * until the next tap outside, because a phone cannot hover. Escape hides it
 * and leaves focus where it is. A coarse pointer gets a 44px target; a mouse
 * gets 24px.
 */
const FieldHint = ({
  label,
  tooltipId,
  children,
}: FieldHintProps): ReactElement => {
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [above, setAbove] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hot, setHot] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const place = (): void => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAbove(window.innerHeight - rect.bottom < 168);
  };
  useEffect(() => {
    if (!pinned) return;
    const close = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setPinned(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [pinned]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      const button = buttonRef.current;
      if (!button) return;
      const open = pinned || hot || document.activeElement === button;
      if (!open) return;
      event.preventDefault();
      event.stopPropagation();
      setPinned(false);
      setSuppressed(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinned, hot]);
  return (
    <span
      ref={rootRef}
      className="group/hint relative inline-flex shrink-0"
      onPointerEnter={() => {
        setHot(true);
        place();
      }}
      onPointerLeave={() => {
        setHot(false);
        if (document.activeElement !== buttonRef.current) {
          setSuppressed(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={tooltipId}
        aria-expanded={pinned}
        className="inline-flex size-6 items-center justify-center rounded-full border border-[var(--border-control)] text-xs leading-none text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] coarse:size-11"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          place();
          setSuppressed(false);
          setPinned((open) => !open);
        }}
        onFocus={() => {
          setSuppressed(false);
          place();
        }}
        onBlur={() => setSuppressed(false)}
      >
        <span aria-hidden="true">?</span>
      </button>
      <span id={tooltipId} className="sr-only">
        {children}
      </span>
      <span
        role="tooltip"
        aria-hidden="true"
        className={`absolute right-0 z-30 ${above ? "bottom-full pb-1" : "top-full pt-1"} ${
          suppressed
            ? "invisible"
            : pinned
              ? "visible"
              : "invisible group-hover/hint:visible group-focus-within/hint:visible"
        }`}
      >
        <span className="block w-64 max-w-[calc(100vw-3rem)] rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-left text-xs font-normal leading-5 text-[var(--text-primary)]">
          {children}
        </span>
      </span>
    </span>
  );
};

const FieldName = ({
  label,
  hint,
  tooltipId,
}: {
  label: string;
  hint: string;
  tooltipId: string;
}): ReactElement => (
  <span className="flex items-center justify-between gap-2">
    <span>{label}</span>
    <FieldHint label={label} tooltipId={tooltipId}>
      {hint}
    </FieldHint>
  </span>
);

const LabeledField = ({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  /** Shown beside the label only when it adds a rule the label does not already state. */
  hint?: string;
  children: ReactNode;
  className?: string;
}): ReactElement => {
  const fieldId = useId();
  const hintId = useId();
  const control = isValidElement<{
    id?: string;
    "aria-describedby"?: string;
  }>(children)
    ? cloneElement(
        children,
        hint
          ? { id: fieldId, "aria-describedby": hintId }
          : { id: fieldId },
      )
    : children;
  return (
    <div className={`text-sm ${className}`}>
      <span className="flex items-center justify-between gap-2">
        <label htmlFor={fieldId}>{label}</label>
        {hint ? (
          <FieldHint label={label} tooltipId={hintId}>
            {hint}
          </FieldHint>
        ) : null}
      </span>
      {control}
    </div>
  );
};

/** Fields shared by a new upload and an edit of a book already on the shelf. */
export interface BookFormInitial {
  title: string;
  authors: string[];
  language: "ky" | "ru";
  categoryId: string;
  subcategoryId: string;
  schoolTextbook: boolean;
  grade: string;
  publishedYear: string;
}

/** What the form hands back. Page range, file, and cover apply only to an upload. */
export interface BookFormDraft extends BookFormInitial {
  newSubcategory: string;
  pageStart: string;
  pageEnd: string;
  file: File | null;
  cover: Blob | null;
  /** Raw page-role inputs from the advanced accordion. */
  pageRoles: {
    cover: string;
    tableOfContents: string;
    glossary: string;
    appendices: string;
    answers: string;
  };
}

export interface BookFormProps {
  mode: "upload" | "edit";
  categories: Category[];
  initial: BookFormInitial;
  busy: boolean;
  message: NoticeState | null;
  onSubmit: (draft: BookFormDraft) => void;
  onCancel?: () => void;
}

export const EMPTY_BOOK_FORM: BookFormInitial = {
  title: "",
  authors: [""],
  language: "ky",
  categoryId: "geography",
  subcategoryId: "",
  schoolTextbook: false,
  grade: "9",
  publishedYear: "",
};

export const bookFormInitial = (book: LibraryBook): BookFormInitial => ({
  title: book.title,
  authors: book.authors.length > 0 ? [...book.authors] : [""],
  language: book.language,
  categoryId: book.categoryId,
  subcategoryId: book.subcategoryId,
  schoolTextbook: book.isSchoolTextbook,
  grade: book.grade === null ? "9" : String(book.grade),
  publishedYear: book.publishedYear === null ? "" : String(book.publishedYear),
});

/**
 * The upload card, also used to edit a book's shelf details.
 * Remount it (change `key`) when `initial` should replace the fields.
 */
export const BookForm = ({
  mode,
  categories,
  initial,
  busy,
  message,
  onSubmit,
  onCancel,
}: BookFormProps): ReactElement => {
  const titleRef = useRef<HTMLInputElement>(null);
  const authorsHintId = useId();
  const schoolHintId = useId();
  const rolesHintId = useId();
  const [title, setTitle] = useState(initial.title);
  const [authors, setAuthors] = useState<string[]>(initial.authors);
  const [language, setLanguage] = useState<"ky" | "ru">(initial.language);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [subcategoryId, setSubcategoryId] = useState(initial.subcategoryId);
  const [newSubcategory, setNewSubcategory] = useState("");
  const [schoolTextbook, setSchoolTextbook] = useState(initial.schoolTextbook);
  const [grade, setGrade] = useState(initial.grade);
  const [publishedYear, setPublishedYear] = useState(initial.publishedYear);
  const [pageStart, setPageStart] = useState("");
  const [pageEnd, setPageEnd] = useState("");
  const [roleCover, setRoleCover] = useState("");
  const [roleToc, setRoleToc] = useState("");
  const [roleGlossary, setRoleGlossary] = useState("");
  const [roleAppendices, setRoleAppendices] = useState("");
  const [roleAnswers, setRoleAnswers] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // What the preview learned from the chosen file; `reading` holds the upload until it has.
  const [preview, setPreview] = useState<PdfPreviewResult | null>(null);
  const [reading, setReading] = useState(false);

  const specialRoles = useMemo((): Map<number, SpecialPageRole> => {
    if (!preview) {
      return new Map();
    }
    const parsed = parsePageRoleAssignments({
      cover: roleCover,
      tableOfContents: roleToc,
      glossary: roleGlossary,
      appendices: roleAppendices,
      answers: roleAnswers,
    });
    if (!parsed.ok) {
      return new Map();
    }
    const resolved = resolvePageRoles(parsed.assignments, preview.pageCount);
    return resolved.ok ? resolved.byPage : new Map();
  }, [
    preview,
    roleCover,
    roleToc,
    roleGlossary,
    roleAppendices,
    roleAnswers,
  ]);

  const hasSpecialRoles = specialRoles.size > 0;

  useEffect(() => {
    if (mode !== "edit") {
      return;
    }
    titleRef.current?.focus({ preventScroll: true });
  }, [mode]);

  const chooseFile = (chosen: File | null): void => {
    setFile(chosen);
    setPreview(null);
    setReading(chosen !== null);
  };

  const onPreviewRead = useCallback((result: PdfPreviewResult | null): void => {
    setPreview(result);
    setReading(false);
  }, []);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    onSubmit({
      title,
      authors,
      language,
      categoryId,
      subcategoryId,
      newSubcategory,
      schoolTextbook,
      grade,
      publishedYear,
      pageStart,
      pageEnd,
      file,
      cover: preview?.cover ?? null,
      pageRoles: {
        cover: roleCover,
        tableOfContents: roleToc,
        glossary: roleGlossary,
        appendices: roleAppendices,
        answers: roleAnswers,
      },
    });
  };

  const divisions =
    categories.find((category) => category.id === categoryId)?.subcategories ??
    [];
  const editing = mode === "edit";
  let submitLabel = hasSpecialRoles
    ? "Upload & extract special pages"
    : "Upload & queue";
  if (editing) {
    submitLabel = busy ? "Saving…" : "Save";
  } else if (busy) {
    submitLabel = "Uploading…";
  }

  return (
    <Card id="book-form" className="scroll-mt-4 max-sm:p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          {editing ? "Edit book" : "Upload a book"}
        </h3>
        {editing ? (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            The original PDF stays as uploaded.
          </p>
        ) : null}
      </div>
      {/* One column on phones and in the side column; two across when stacked on a tablet. */}
      <form
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"
        onSubmit={submit}
      >
        <LabeledField label="Title">
          <input
            ref={titleRef}
            className={FIELD}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </LabeledField>
        <div
          className="grid gap-2 text-sm sm:col-span-2 lg:col-span-1"
          role="group"
          aria-label="Authors"
        >
          <FieldName
            label="Authors"
            hint="One person per row. Empty rows are left out."
            tooltipId={authorsHintId}
          />
          {authors.map((name, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                className={fieldClass}
                aria-label={`Author ${index + 1}`}
                aria-describedby={authorsHintId}
                value={name}
                onChange={(event) =>
                  setAuthors((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  )
                }
              />
              {authors.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setAuthors((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() => setAuthors((current) => [...current, ""])}
          >
            Add author
          </Button>
        </div>
        <LabeledField
          label="Language"
          hint="The language of the printed pages. Text is transcribed, not translated."
        >
          <select
            className={FIELD}
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value as "ky" | "ru")
            }
          >
            <option value="ky">Kyrgyz</option>
            <option value="ru">Russian</option>
          </select>
        </LabeledField>
        <LabeledField
          label="Year"
          hint="The year on the title page. Leave blank if it is not printed."
        >
          <input
            className={FIELD}
            inputMode="numeric"
            value={publishedYear}
            onChange={(event) => setPublishedYear(event.target.value)}
            placeholder="2024"
          />
        </LabeledField>
        <LabeledField label="Category">
          <select
            className={FIELD}
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setSubcategoryId("");
              setNewSubcategory("");
            }}
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </LabeledField>
        <LabeledField
          label="Subcategory"
          hint="The division inside that shelf. Add one if it is not listed."
        >
          <select
            className={FIELD}
            value={subcategoryId}
            onChange={(event) => setSubcategoryId(event.target.value)}
            required
          >
            <option value="">Choose a division</option>
            {divisions.map((division) => (
              <option key={division.id} value={division.id}>
                {division.name}
              </option>
            ))}
            <option value="new">Add a division…</option>
          </select>
        </LabeledField>
        {subcategoryId === "new" ? (
          <LabeledField
            className="sm:col-span-2 lg:col-span-1"
            label="New division"
          >
            <input
              className={FIELD}
              value={newSubcategory}
              onChange={(event) => setNewSubcategory(event.target.value)}
              required
            />
          </LabeledField>
        ) : null}
        <div className="flex items-center justify-between gap-2 text-sm sm:col-span-2 lg:col-span-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent-primary)] coarse:size-6"
              checked={schoolTextbook}
              aria-describedby={schoolHintId}
              onChange={(event) => setSchoolTextbook(event.target.checked)}
            />
            School textbook
          </label>
          <FieldHint label="School textbook" tooltipId={schoolHintId}>
            Turn on when this book is written for a school grade. A grade field appears so it can be filed with that year.
          </FieldHint>
        </div>
        {schoolTextbook ? (
          <LabeledField label="Grade">
            <select
              className={FIELD}
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              required
            >
              {SCHOOL_GRADES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </LabeledField>
        ) : null}
        {editing ? null : (
          <>
            <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <LabeledField
                  label="Digitize from"
                  hint="First PDF page sent to AI. This is the file’s page number, not the number printed on the paper. Blank starts at page 1."
                >
                  <input
                    className={FIELD}
                    inputMode="numeric"
                    value={pageStart}
                    onChange={(event) => setPageStart(event.target.value)}
                    placeholder="1"
                  />
                </LabeledField>
                <LabeledField
                  label="Digitize through"
                  hint="Last PDF page sent to AI. Blank means the last page of the file. Pages outside this range stay saved and can be digitized later."
                >
                  <input
                    className={FIELD}
                    inputMode="numeric"
                    value={pageEnd}
                    onChange={(event) => setPageEnd(event.target.value)}
                    placeholder={preview ? String(preview.pageCount) : "all"}
                  />
                </LabeledField>
              </div>
              {preview ? (
                <p className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                  {preview.pageCount}{" "}
                  {preview.pageCount === 1 ? "page" : "pages"} saved
                  {(() => {
                    const queued = queuedPageCount(
                      preview.pageCount,
                      pageStart,
                      pageEnd,
                      specialRoles,
                    );
                    return queued === null
                      ? null
                      : hasSpecialRoles
                        ? ` · ${queued} special ${queued === 1 ? "page" : "pages"} first`
                        : ` · ${queued} sent to AI`;
                  })()}
                </p>
              ) : null}
            </div>
            <div className="relative rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] sm:col-span-2 lg:col-span-1">
            <details className="group/disclosure">
              <summary
                aria-describedby={rolesHintId}
                className="flex cursor-pointer list-none items-center gap-2 py-2 pl-3 pr-12 text-sm font-medium [&::-webkit-details-marker]:hidden"
              >
                <ChevronDownIcon className="text-[var(--text-secondary)] transition-transform duration-200 ease-out group-open/disclosure:rotate-180" />
                <span className="flex-1">Advanced: Page roles</span>
              </summary>
              <div className="grid gap-3 border-t border-[var(--border-hairline)] px-3 py-3">
                {(
                  [
                    [
                      "Cover",
                      "Title and imprint pages. Read for the title, authors, year, and publisher. Not turned into lessons.",
                      roleCover,
                      setRoleCover,
                    ],
                    [
                      "Table of contents",
                      "Pages that list the chapters and lessons. They are read first so you can edit the outline before the rest of the book.",
                      roleToc,
                      setRoleToc,
                    ],
                    [
                      "Glossary",
                      "Each term and its definition, in the book’s language.",
                      roleGlossary,
                      setRoleGlossary,
                    ],
                    [
                      "Appendices",
                      "Reference tables, maps, and notes after the lessons, such as Тиркеме or Приложение.",
                      roleAppendices,
                      setRoleAppendices,
                    ],
                    [
                      "Answers",
                      "Answer keys. Kept as a reference, not as lessons.",
                      roleAnswers,
                      setRoleAnswers,
                    ],
                  ] as const
                ).map(([label, hint, value, setValue]) => (
                  <LabeledField key={label} label={label} hint={hint}>
                    <input
                      className={FIELD}
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder="optional"
                      inputMode="numeric"
                    />
                  </LabeledField>
                ))}
              </div>
            </details>
            <span className="absolute right-3 top-2">
              <FieldHint label="Page roles" tooltipId={rolesHintId}>
                Optional. Name special pages so they are read with their own instructions before the lessons. Every field accepts a list, a range, or an array of page numbers, such as 1, 2, 222-223, or [248, 249]. Leave every field blank to digitize the body in one pass.
              </FieldHint>
            </span>
            </div>
            <LabeledField
              className="sm:col-span-2 lg:col-span-1"
              label="PDF file"
              hint="The original file is stored unchanged. A preview of the first page is saved as the cover image."
            >
              <input
                className="mt-1 block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:cursor-pointer file:rounded-[var(--rounded-xs)] file:border file:border-solid file:border-[var(--border-control)] file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--text-primary)] hover:file:bg-[var(--bg-hover)] coarse:file:py-[11px]"
                type="file"
                accept="application/pdf"
                onChange={(event) =>
                  chooseFile(event.target.files?.[0] ?? null)
                }
                required
              />
            </LabeledField>
            {file ? (
              <div className="sm:col-span-2 lg:col-span-1">
                <PdfPreview
                  file={file}
                  onRead={onPreviewRead}
                  pageInRange={
                    preview
                      ? (pageNumber) => {
                          if (hasSpecialRoles) {
                            return specialRoles.has(pageNumber);
                          }
                          return pageInDigitizeRange(
                            pageNumber,
                            preview.pageCount,
                            pageStart,
                            pageEnd,
                          );
                        }
                      : undefined
                  }
                  pageRoleLabel={(pageNumber) => {
                    const role = roleForPreviewPage(pageNumber, specialRoles);
                    return role === "body" ? null : pageRoleLabel(role);
                  }}
                />
              </div>
            ) : null}
          </>
        )}
        {message ? (
          <Notice
            tone={message.tone}
            className="sm:col-span-2 lg:col-span-1"
          >
            {message.text}
          </Notice>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2 sm:col-span-2 lg:col-span-1">
          <Button
            type="submit"
            disabled={busy || categories.length === 0 || (!editing && reading)}
          >
            {submitLabel}
          </Button>
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
};
