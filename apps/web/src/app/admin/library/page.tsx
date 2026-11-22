"use client";

import type { Book } from "@oku/db";
import { Button, Card, Notice, StatusPill, fieldClass } from "@oku/ui";
import type { NoticeState } from "@oku/ui";
import Link from "next/link";
import type { FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { AdminGate } from "@/components/admin-gate";
import { BookCover } from "@/components/book-cover";
import { ExtractionModelCard } from "@/components/extraction-model-card";
import { PdfPreview } from "@/components/pdf-preview";
import type { PdfPreviewResult } from "@/components/pdf-preview";

const FIELD = `${fieldClass} mt-1`;

const LibraryPage = (): ReactElement => {
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [language, setLanguage] = useState<"ky" | "ru">("ky");
  const [pageStart, setPageStart] = useState("");
  const [pageEnd, setPageEnd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // What the preview learned from the chosen file; `reading` holds the upload until it has.
  const [preview, setPreview] = useState<PdfPreviewResult | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<NoticeState | null>(null);

  const loadBooks = async (): Promise<void> => {
    const response = await fetch("/api/admin/books");
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as { books: Book[] };
    setBooks(data.books);
  };

  useEffect(() => {
    void loadBooks();
  }, []);

  const chooseFile = (chosen: File | null): void => {
    setFile(chosen);
    setPreview(null);
    setReading(chosen !== null);
  };

  const onPreviewRead = useCallback((result: PdfPreviewResult | null): void => {
    setPreview(result);
    setReading(false);
  }, []);

  const onUpload = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!file) {
      setMessage({ text: "Choose a PDF first", tone: "error" });
      return;
    }
    setBusy(true);
    setMessage(null);

    const form = new FormData();
    form.set("file", file);
    form.set("title", title);
    form.set("authorName", authorName);
    form.set("language", language);
    if (pageStart) form.set("pageStart", pageStart);
    if (pageEnd) form.set("pageEnd", pageEnd);
    // The first page as an image, saved next to the original PDF.
    if (preview?.cover) form.set("cover", preview.cover, "cover");

    const response = await fetch("/api/admin/books", {
      method: "POST",
      body: form,
    });
    const data = (await response.json()) as {
      bookId?: string;
      error?: string;
      pageStart?: number;
      pageEnd?: number;
    };

    setBusy(false);
    if (!response.ok) {
      setMessage({ text: data.error ?? "Upload failed", tone: "error" });
      return;
    }

    setMessage({
      text: `Queued pages ${data.pageStart}-${data.pageEnd}. Opening book…`,
      tone: "info",
    });
    setTitle("");
    setAuthorName("");
    setPageStart("");
    setPageEnd("");
    chooseFile(null);
    await loadBooks();
    if (data.bookId) {
      window.location.href = `/admin/library/${data.bookId}`;
    }
  };

  return (
    <AdminGate>
      {/* The book list leads. Upload is a side column from lg and drops below the list under it. */}
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
                Grade 9 Political Geography — Kyrgyz & Russian
              </p>
            </div>
            <Button variant="ghost" onClick={() => void loadBooks()}>
              Refresh
            </Button>
          </div>

          {books.length === 0 ? (
            <p className="mt-6 border-t border-[var(--border-hairline)] pt-6 text-[var(--text-secondary)]">
              No books yet. Upload a PDF to start ingestion.
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-[var(--border-hairline)] overflow-hidden rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              {books.map((book) => (
                <li
                  key={book.id}
                  className="relative flex items-start gap-4 px-4 py-4 transition-colors hover:bg-[var(--bg-hover)] active:bg-[var(--bg-hover)] sm:items-center sm:px-6"
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
                        {book.language.toUpperCase()} · grade {book.grade} ·{" "}
                        {book.subject}
                      </p>
                    </div>
                    <div className="mt-2 shrink-0 sm:mt-0">
                      <StatusPill status={book.status} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Side column: upload, then the setting that decides how uploads are read. */}
        <div className="grid gap-6">
          <Card className="max-sm:p-4">
            <h3 className="mb-4 text-lg font-semibold">Upload textbook PDF</h3>
            {/* One column on phones and in the side column; two across when stacked on a tablet. */}
            <form
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"
              onSubmit={onUpload}
            >
              <label className="block text-sm">
                Title
                <input
                  className={FIELD}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                Author
                <input
                  className={FIELD}
                  value={authorName}
                  onChange={(event) => setAuthorName(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Language
                <select
                  className={FIELD}
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as "ky" | "ru")
                  }
                >
                  <option value="ky">Kyrgyz (ky)</option>
                  <option value="ru">Russian (ru)</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Page start
                  <input
                    className={FIELD}
                    inputMode="numeric"
                    value={pageStart}
                    onChange={(event) => setPageStart(event.target.value)}
                    placeholder="1"
                  />
                </label>
                <label className="block text-sm">
                  Page end
                  <input
                    className={FIELD}
                    inputMode="numeric"
                    value={pageEnd}
                    onChange={(event) => setPageEnd(event.target.value)}
                    placeholder={preview ? String(preview.pageCount) : "all"}
                  />
                </label>
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
                  <PdfPreview file={file} onRead={onPreviewRead} />
                </div>
              ) : null}
              {message ? (
                <Notice
                  tone={message.tone}
                  className="sm:col-span-2 lg:col-span-1"
                >
                  {message.text}
                </Notice>
              ) : null}
              <div className="pt-2 sm:col-span-2 lg:col-span-1">
                <Button type="submit" disabled={busy || reading}>
                  {busy ? "Uploading…" : "Upload & queue"}
                </Button>
              </div>
            </form>
          </Card>
          <ExtractionModelCard />
        </div>
      </div>
    </AdminGate>
  );
};

export default LibraryPage;
