"use client";

import {
  Button,
  Notice,
  PencilIcon,
  RefreshIcon,
  StatusPill,
  TrashIcon,
} from "@oku/ui";
import type { NoticeState } from "@oku/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  NETWORK_MESSAGE,
  SESSION_MESSAGE,
  failureText,
  isTimeout,
  readJson,
} from "@/lib/admin-request";
import { AdminGate } from "@/components/admin-gate";
import { BookCover } from "@/components/book-cover";
import { BookForm, EMPTY_BOOK_FORM, bookFormInitial } from "@/components/book-form";
import type { BookFormDraft } from "@/components/book-form";
import { ExtractionModelCard } from "@/components/extraction-model-card";
import type { Category, LibraryBook } from "@/lib/catalog";
import { shelfLine } from "@/lib/catalog";
import type { LibraryCatalog, LibrarySession } from "@/lib/library-session";
import { forgetBookDetail } from "@/lib/use-book-detail";

type LoadError = "network" | "unauthorized" | "failed";

interface LibraryShelfProps {
  catalog: LibraryCatalog;
  model: LibrarySession["model"];
}

const editButtonId = (bookId: string): string => `edit-${bookId}`;

const loadErrorText = (error: LoadError): string => {
  if (error === "network") return NETWORK_MESSAGE;
  if (error === "unauthorized") return SESSION_MESSAGE;
  return "The library could not be loaded. Refresh to try again.";
};

const LibraryLoadError = ({ error }: { error: LoadError }): ReactElement => (
  <div className="mt-4">
    <Notice tone="error">{loadErrorText(error)}</Notice>
    {error === "unauthorized" ? (
      <Button className="mt-3" onClick={() => window.location.reload()}>
        Reload
      </Button>
    ) : null}
  </div>
);

const LibraryShelf = ({ catalog, model }: LibraryShelfProps): ReactElement => {
  const [books, setBooks] = useState<LibraryBook[]>(catalog.books);
  const [categories, setCategories] = useState<Category[]>(catalog.categories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<NoticeState | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const loadSeq = useRef(0);
  const mounted = useRef(true);
  const focusAfter = useRef<string | null>(null);

  const loadBooks = useCallback(async (): Promise<boolean> => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/admin/books", {
        signal: AbortSignal.timeout(20_000),
      });
      if (!mounted.current || seq !== loadSeq.current) return false;
      if (!response.ok) {
        setLoadError(response.status === 401 ? "unauthorized" : "failed");
        return false;
      }
      const data = await readJson<LibraryCatalog>(response);
      if (!mounted.current || seq !== loadSeq.current) return false;
      if (
        !data ||
        !Array.isArray(data.books) ||
        !Array.isArray(data.categories)
      ) {
        setLoadError("failed");
        return false;
      }
      setBooks(data.books);
      setCategories(data.categories);
      return true;
    } catch (caught) {
      if (!mounted.current || seq !== loadSeq.current) return false;
      setLoadError(isTimeout(caught) ? "failed" : "network");
      return false;
    } finally {
      if (mounted.current && seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    const node = document.getElementById(id);
    if (!node) return;
    focusAfter.current = null;
    node.focus({ focusVisible: true } as FocusOptions);
  });

  const editing = books.find((book) => book.id === editingId) ?? null;

  useEffect(() => {
    if (!editingId) {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("book-form")?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "nearest",
    });
  }, [editingId]);

  const openEdit = (bookId: string): void => {
    setSaved(null);
    setMessage(null);
    setEditingId(bookId);
  };

  const cancelEdit = (): void => {
    if (editingId) focusAfter.current = editButtonId(editingId);
    setMessage(null);
    setEditingId(null);
  };

  const uploadBook = async (draft: BookFormDraft): Promise<void> => {
    if (!draft.file) {
      setMessage({ text: "Choose a PDF first", tone: "error" });
      return;
    }
    setBusy(true);
    setMessage(null);

    const form = new FormData();
    form.set("file", draft.file);
    form.set("title", draft.title);
    draft.authors.forEach((name) => {
      const trimmed = name.trim();
      if (trimmed) form.append("authors", trimmed);
    });
    form.set("language", draft.language);
    form.set("categoryId", draft.categoryId);
    form.set("subcategoryId", draft.subcategoryId);
    if (draft.subcategoryId === "new") {
      form.set("newSubcategory", draft.newSubcategory);
    }
    form.set("schoolTextbook", draft.schoolTextbook ? "true" : "false");
    if (draft.schoolTextbook) form.set("grade", draft.grade);
    if (draft.publishedYear.trim()) {
      form.set("publishedYear", draft.publishedYear.trim());
    }
    if (draft.pageStart) form.set("pageStart", draft.pageStart);
    if (draft.pageEnd) form.set("pageEnd", draft.pageEnd);
    form.set("roleCover", draft.pageRoles.cover);
    form.set("roleTableOfContents", draft.pageRoles.tableOfContents);
    form.set("roleGlossary", draft.pageRoles.glossary);
    form.set("roleAppendices", draft.pageRoles.appendices);
    form.set("roleAnswers", draft.pageRoles.answers);
    // The first page as an image, saved next to the original PDF.
    if (draft.cover) form.set("cover", draft.cover, "cover");

    let response: Response;
    try {
      response = await fetch("/api/admin/books", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (caught) {
      setBusy(false);
      setMessage({
        text: isTimeout(caught)
          ? "The upload took too long. Try again."
          : NETWORK_MESSAGE,
        tone: "error",
      });
      return;
    }
    const data = (await readJson<{
      bookId?: string;
      error?: string;
      totalPages?: number;
      pageStart?: number;
      pageEnd?: number;
      bodyConversionQueued?: boolean;
      specialPageCount?: number;
    }>(response)) ?? {};

    setBusy(false);
    if (!response.ok) {
      setMessage({
        text: data.error ?? failureText(response.status, "Upload failed"),
        tone: "error",
      });
      return;
    }

    const saved =
      data.totalPages === undefined
        ? null
        : `${data.totalPages} ${data.totalPages === 1 ? "page" : "pages"}`;
    const specials =
      data.bodyConversionQueued === false && data.specialPageCount
        ? ` Extracting ${data.specialPageCount} special ${data.specialPageCount === 1 ? "page" : "pages"} first.`
        : data.pageStart !== undefined && data.pageEnd !== undefined
          ? ` Queued ${data.pageStart}–${data.pageEnd} for digitizing.`
          : "";
    setMessage({
      text: saved
        ? `Saved ${saved}.${specials} Opening book…`
        : "Book uploaded. Opening…",
      tone: "info",
    });
    await loadBooks();
    if (data.bookId) {
      window.location.href = `/admin/library/${data.bookId}`;
    }
  };

  const saveBook = async (bookId: string, draft: BookFormDraft): Promise<void> => {
    setBusy(true);
    setMessage(null);
    let response: Response;
    try {
      response = await fetch(`/api/admin/books/${bookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          authors: draft.authors,
          language: draft.language,
          categoryId: draft.categoryId,
          subcategoryId: draft.subcategoryId,
          newSubcategory: draft.newSubcategory,
          schoolTextbook: draft.schoolTextbook,
          grade: draft.grade,
          publishedYear: draft.publishedYear,
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (caught) {
      setBusy(false);
      setMessage({
        text: isTimeout(caught)
          ? "Saving took too long. Try again."
          : NETWORK_MESSAGE,
        tone: "error",
      });
      return;
    }
    const data = (await readJson<{
      book?: LibraryBook;
      error?: string;
    }>(response)) ?? {};

    setBusy(false);
    if (!response.ok) {
      setMessage({
        text: data.error ?? failureText(response.status, "Could not save the book"),
        tone: "error",
      });
      return;
    }

    focusAfter.current = editButtonId(bookId);
    setEditingId(null);
    setSaved(data.book?.title ?? draft.title.trim());
    await loadBooks();
  };

  const onSubmit = (draft: BookFormDraft): void => {
    if (editing) {
      void saveBook(editing.id, draft);
      return;
    }
    void uploadBook(draft);
  };

  const deleteBook = async (book: LibraryBook): Promise<void> => {
    if (
      !window.confirm(
        `Delete “${book.title}”? This removes the book, its pages, and the original PDF.`,
      )
    ) {
      return;
    }
    setDeletingId(book.id);
    setMessage(null);
    setSaved(null);
    let response: Response;
    try {
      response = await fetch(`/api/admin/books/${book.id}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (caught) {
      setDeletingId(null);
      setMessage({
        text: isTimeout(caught)
          ? "Deleting took too long. Try again."
          : NETWORK_MESSAGE,
        tone: "error",
      });
      return;
    }
    const data = (await readJson<{
      error?: string;
      title?: string;
    }>(response)) ?? {};
    setDeletingId(null);
    if (!response.ok) {
      setMessage({
        text: data.error ?? failureText(response.status, "Could not delete the book"),
        tone: "error",
      });
      return;
    }
    const index = books.findIndex((item) => item.id === book.id);
    const neighbor = books[index + 1] ?? books[index - 1] ?? null;
    focusAfter.current = neighbor ? editButtonId(neighbor.id) : "library-heading";
    setBooks((current) => current.filter((item) => item.id !== book.id));
    if (editingId === book.id) {
      setEditingId(null);
    }
    forgetBookDetail(book.id);
    setMessage({
      text: `Deleted ${data.title ?? book.title}`,
      tone: "info",
    });
    await loadBooks();
  };

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-11">
      {/* The book list leads. Upload and edit share the side column, and drop below the list under lg. */}
        <section aria-labelledby="library-heading" aria-busy={loading}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2
                id="library-heading"
                tabIndex={-1}
                className="text-2xl font-bold tracking-tight"
              >
                Library
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Kyrgyz and Russian books
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh"
              title="Refresh"
              aria-busy={loading}
              disabled={loading}
              onClick={() => void loadBooks()}
            >
              <RefreshIcon />
            </Button>
          </div>

          {saved ? (
            <Notice tone="info" className="mt-4">
              Saved {saved}
            </Notice>
          ) : null}

          {loading && books.length === 0 ? (
            <p
              role="status"
              className="mt-6 text-[var(--text-secondary)]"
            >
              Loading the library…
            </p>
          ) : loadError && books.length === 0 ? (
            <LibraryLoadError error={loadError} />
          ) : books.length === 0 ? (
            <p className="mt-6 border-t border-[var(--border-hairline)] pt-6 text-[var(--text-secondary)]">
              No books yet. Upload a PDF to start ingestion.
            </p>
          ) : (
            <>
              {loadError ? <LibraryLoadError error={loadError} /> : null}
              <ul className="mt-6 divide-y divide-[var(--border-hairline)] overflow-hidden rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              {books.map((book) => {
                const selected = editing?.id === book.id;
                return (
                  <li
                    key={book.id}
                    className={`relative flex items-start gap-4 px-4 py-4 transition-colors sm:items-center sm:px-6 ${
                      selected
                        ? "bg-[var(--bg-hover)]"
                        : "hover:bg-[var(--bg-hover)] active:bg-[var(--bg-hover)]"
                    }`}
                  >
                    <BookCover url={book.coverImageUrl} className="h-16 w-12" />
                    {/* On phones the status sits under the title, so the title keeps the row's width. */}
                    <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <Link
                          lang={book.language}
                          className="break-words text-lg font-semibold after:absolute after:inset-0"
                          href={`/admin/library/${book.id}`}
                        >
                          {book.title}
                        </Link>
                        <p className="mt-1 break-words font-mono text-xs text-[var(--text-secondary)]">
                          {shelfLine(book)}
                        </p>
                        {book.authors.length > 0 ? (
                          <p
                            lang={book.language}
                            className="mt-1 break-words text-sm text-[var(--text-secondary)]"
                          >
                            {book.authors.join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-2 sm:mt-0">
                        <StatusPill status={book.status} />
                        <Button
                          variant={selected ? "secondary" : "ghost"}
                          size="icon"
                          className="relative z-10"
                          id={editButtonId(book.id)}
                          aria-label={`Edit ${book.title}`}
                          title="Edit"
                          aria-pressed={selected}
                          aria-controls="book-form"
                          disabled={busy || deletingId !== null}
                          onClick={() => openEdit(book.id)}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="relative z-10"
                          aria-label={
                            deletingId === book.id
                              ? `Deleting ${book.title}`
                              : `Delete ${book.title}`
                          }
                          title={
                            deletingId === book.id ? "Deleting…" : "Delete"
                          }
                          disabled={busy || deletingId !== null}
                          onClick={() => void deleteBook(book)}
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
              </ul>
            </>
          )}
        </section>

        {/* Side column: the book form, then the setting that decides how uploads are read. */}
        <div className="grid gap-6">
          <BookForm
            key={editing?.id ?? "upload"}
            mode={editing ? "edit" : "upload"}
            categories={categories}
            initial={editing ? bookFormInitial(editing) : EMPTY_BOOK_FORM}
            busy={busy}
            message={message}
            onSubmit={onSubmit}
            onCancel={editing ? cancelEdit : undefined}
          />
          <ExtractionModelCard initial={model} />
        </div>
    </div>
  );
};

const LibraryPage = (): ReactElement => (
  <AdminGate withCatalog>
    {(session) => (
      <LibraryShelf catalog={session.catalog} model={session.model} />
    )}
  </AdminGate>
);

export default LibraryPage;
