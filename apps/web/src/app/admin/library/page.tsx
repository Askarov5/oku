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
import { useEffect, useState } from "react";
import { AdminGate } from "@/components/admin-gate";
import { BookCover } from "@/components/book-cover";
import { BookForm, EMPTY_BOOK_FORM, bookFormInitial } from "@/components/book-form";
import type { BookFormDraft } from "@/components/book-form";
import { ExtractionModelCard } from "@/components/extraction-model-card";
import type { Category, LibraryBook } from "@/lib/catalog";
import { shelfLine } from "@/lib/catalog";
import { forgetBookDetail } from "@/lib/use-book-detail";

const LibraryPage = (): ReactElement => {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<NoticeState | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const loadBooks = async (): Promise<void> => {
    const response = await fetch("/api/admin/books");
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as {
      books: LibraryBook[];
      categories: Category[];
    };
    setBooks(data.books);
    setCategories(data.categories);
  };

  useEffect(() => {
    void loadBooks();
  }, []);

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
    // The first page as an image, saved next to the original PDF.
    if (draft.cover) form.set("cover", draft.cover, "cover");

    const response = await fetch("/api/admin/books", {
      method: "POST",
      body: form,
    });
    const data = (await response.json().catch(() => ({}))) as {
      bookId?: string;
      error?: string;
      totalPages?: number;
      pageStart?: number;
      pageEnd?: number;
    };

    setBusy(false);
    if (!response.ok) {
      setMessage({ text: data.error ?? "Upload failed", tone: "error" });
      return;
    }

    const saved =
      data.totalPages === undefined
        ? null
        : `${data.totalPages} ${data.totalPages === 1 ? "page" : "pages"}`;
    setMessage({
      text:
        saved && data.pageStart !== undefined && data.pageEnd !== undefined
          ? `Saved ${saved}. Queued ${data.pageStart}–${data.pageEnd} for digitizing. Opening book…`
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
    const response = await fetch(`/api/admin/books/${bookId}`, {
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
    });
    const data = (await response.json()) as {
      book?: LibraryBook;
      error?: string;
    };

    setBusy(false);
    if (!response.ok) {
      setMessage({ text: data.error ?? "Could not save the book", tone: "error" });
      return;
    }

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
    const response = await fetch(`/api/admin/books/${book.id}`, {
      method: "DELETE",
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      title?: string;
    };
    setDeletingId(null);
    if (!response.ok) {
      setMessage({
        text: data.error ?? "Could not delete the book",
        tone: "error",
      });
      return;
    }
    if (editingId === book.id) {
      setEditingId(null);
    }
    forgetBookDetail(book.id);
    setSaved(null);
    setMessage({
      text: `Deleted ${data.title ?? book.title}`,
      tone: "info",
    });
    await loadBooks();
  };

  return (
    <AdminGate>
      {/* The book list leads. Upload and edit share the side column, and drop below the list under lg. */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-11">
        <section aria-labelledby="library-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2
                id="library-heading"
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

          {books.length === 0 ? (
            <p className="mt-6 border-t border-[var(--border-hairline)] pt-6 text-[var(--text-secondary)]">
              No books yet. Upload a PDF to start ingestion.
            </p>
          ) : (
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
                          className="text-lg font-semibold after:absolute after:inset-0"
                          href={`/admin/library/${book.id}`}
                        >
                          {book.title}
                        </Link>
                        <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                          {shelfLine(book)}
                        </p>
                        {book.authors.length > 0 ? (
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
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
          <ExtractionModelCard />
        </div>
      </div>
    </AdminGate>
  );
};

export default LibraryPage;
