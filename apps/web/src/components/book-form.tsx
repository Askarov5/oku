"use client";

import { Button, Card, Notice, fieldClass } from "@oku/ui";
import type { NoticeState } from "@oku/ui";
import type { FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PdfPreview } from "@/components/pdf-preview";
import type { PdfPreviewResult } from "@/components/pdf-preview";
import type { Category, LibraryBook } from "@/lib/catalog";
import { SCHOOL_GRADES } from "@/lib/catalog";
import {
  pageInDigitizeRange,
  queuedPageCount,
} from "@/lib/book-page-range";

const FIELD = `${fieldClass} mt-1`;

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
  const [file, setFile] = useState<File | null>(null);
  // What the preview learned from the chosen file; `reading` holds the upload until it has.
  const [preview, setPreview] = useState<PdfPreviewResult | null>(null);
  const [reading, setReading] = useState(false);

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
    });
  };

  const divisions =
    categories.find((category) => category.id === categoryId)?.subcategories ??
    [];
  const editing = mode === "edit";
  let submitLabel = "Upload & queue";
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
        <label className="block text-sm">
          Title
          <input
            ref={titleRef}
            className={FIELD}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>
        <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
          <span className="text-sm">Authors</span>
          {authors.map((name, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                className={fieldClass}
                aria-label={`Author ${index + 1}`}
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
        <label className="block text-sm">
          Language
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
        </label>
        <label className="block text-sm">
          Year
          <input
            className={FIELD}
            inputMode="numeric"
            value={publishedYear}
            onChange={(event) => setPublishedYear(event.target.value)}
            placeholder="2024"
          />
        </label>
        <label className="block text-sm">
          Category
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
        </label>
        <label className="block text-sm">
          Subcategory
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
        </label>
        {subcategoryId === "new" ? (
          <label className="block text-sm sm:col-span-2 lg:col-span-1">
            New division
            <input
              className={FIELD}
              value={newSubcategory}
              onChange={(event) => setNewSubcategory(event.target.value)}
              required
            />
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-1">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent-primary)]"
            checked={schoolTextbook}
            onChange={(event) => setSchoolTextbook(event.target.checked)}
          />
          School textbook
        </label>
        {schoolTextbook ? (
          <label className="block text-sm">
            Grade
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
          </label>
        ) : null}
        {editing ? null : (
          <>
            <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Digitize from
                  <input
                    className={FIELD}
                    inputMode="numeric"
                    value={pageStart}
                    onChange={(event) => setPageStart(event.target.value)}
                    placeholder="1"
                  />
                </label>
                <label className="block text-sm">
                  Digitize through
                  <input
                    className={FIELD}
                    inputMode="numeric"
                    value={pageEnd}
                    onChange={(event) => setPageEnd(event.target.value)}
                    placeholder={preview ? String(preview.pageCount) : "all"}
                  />
                </label>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                The full PDF is saved. Only this range is sent to AI; the other
                pages stay in the book to digitize later. Leave blank to
                digitize the whole file.
              </p>
              {preview ? (
                <p className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                  {preview.pageCount}{" "}
                  {preview.pageCount === 1 ? "page" : "pages"} saved
                  {(() => {
                    const queued = queuedPageCount(
                      preview.pageCount,
                      pageStart,
                      pageEnd,
                    );
                    return queued === null
                      ? null
                      : ` · ${queued} sent to AI`;
                  })()}
                </p>
              ) : null}
            </div>
            <label className="block text-sm sm:col-span-2 lg:col-span-1">
              PDF file
              <input
                className="mt-1 block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:cursor-pointer file:rounded-[var(--rounded-xs)] file:border file:border-solid file:border-[var(--border-control)] file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--text-primary)] hover:file:bg-[var(--bg-hover)] coarse:file:py-[11px]"
                type="file"
                accept="application/pdf"
                onChange={(event) =>
                  chooseFile(event.target.files?.[0] ?? null)
                }
                required
              />
            </label>
            {file ? (
              <div className="sm:col-span-2 lg:col-span-1">
                <PdfPreview
                  file={file}
                  onRead={onPreviewRead}
                  pageInRange={
                    preview
                      ? (pageNumber) =>
                          pageInDigitizeRange(
                            pageNumber,
                            preview.pageCount,
                            pageStart,
                            pageEnd,
                          )
                      : undefined
                  }
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
