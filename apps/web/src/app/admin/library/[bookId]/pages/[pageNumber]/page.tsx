"use client";

import type { BookPage } from "@oku/db";
import { Notice, StatusPill } from "@oku/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { AdminGate } from "@/components/admin-gate";
import { PageReviewEditor } from "@/components/page-review-editor";
import { readPageJson, readingHref, useBookOutline } from "@/lib/book-outline";
import { pageLabel } from "@/lib/page-label";
import { useBookDetail } from "@/lib/use-book-detail";

// A page is read in seconds; the wait covers the reader's own retries when the service is busy.
const POLL_MS = 2000;
const WAIT_LIMIT_MS = 6 * 60 * 1000;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** What a page being read again is doing, in a few words for the review bar. */
const readingNote = (stage: string | null): string => {
  switch (stage) {
    case "rasterizing":
      return "Preparing the page image.";
    case "extracting":
      return "Reading the page.";
    case "queued":
      return "Queued, waiting for the reader.";
    default:
      return "Waiting for the reader.";
  }
};

const PageReviewRoute = (): ReactElement => {
  const params = useParams<{ bookId: string; pageNumber: string }>();
  const bookId = params.bookId;
  const pageNumber = Number(params.pageNumber);
  const { data: book, refresh: refreshBook } = useBookDetail(bookId);
  const [loaded, setLoaded] = useState<BookPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The stage reported while waiting, newer than the one on `loaded`.
  const [stage, setStage] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const response = await fetch(
      `/api/admin/books/${bookId}/pages/${pageNumber}`,
    );
    if (!response.ok) {
      setError("Failed to load page");
      return;
    }
    const data = (await response.json()) as { page: BookPage };
    setError(null);
    setLoaded(data.page);
  }, [bookId, pageNumber]);

  useEffect(() => {
    setStage(null);
    void load();
  }, [load]);

  // While moving between pages, the previous page must not show under the new heading.
  const page = loaded && loaded.pageNumber === pageNumber ? loaded : null;
  const retrying = page?.status === "pending";

  // A page left pending (just queued here, or already waiting) is followed until it settles.
  useEffect(() => {
    if (!page || page.status !== "pending") {
      return undefined;
    }
    let stopped = false;
    const started = Date.now();

    const follow = async (): Promise<void> => {
      while (!stopped && Date.now() - started < WAIT_LIMIT_MS) {
        await wait(POLL_MS);
        if (stopped) {
          return;
        }
        const response = await fetch(
          `/api/admin/books/${bookId}/pages/${pageNumber}`,
        );
        if (!response.ok) {
          continue;
        }
        const data = (await response.json()) as { page: BookPage };
        if (data.page.status === "pending") {
          setStage(data.page.stage);
          continue;
        }
        setStage(null);
        setLoaded(data.page);
        void refreshBook();
        return;
      }
      if (!stopped) {
        setError(
          "Still reading this page. Refresh in a moment to see the result.",
        );
      }
    };

    void follow();
    return () => {
      stopped = true;
    };
  }, [page, bookId, pageNumber, refreshBook]);

  const retry = async (): Promise<void> => {
    if (!page || page.status === "pending") {
      return;
    }
    if (
      page.status === "reviewed" &&
      !window.confirm(
        "This page is marked reviewed. Reading it again replaces that text.",
      )
    ) {
      return;
    }
    setError(null);
    const response = await fetch(
      `/api/admin/books/${bookId}/pages/${pageNumber}/retry`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: page.status === "reviewed" }),
      },
    );
    const data = (await response.json()) as { page?: BookPage; error?: string };
    if (!response.ok || !data.page) {
      setError(data.error ?? "Retry failed");
      return;
    }
    setStage(data.page.stage);
    setLoaded(data.page);
  };

  const initialJson = page ? readPageJson(page) : null;
  const outline = useBookOutline(book);
  const printedPage =
    initialJson?.printedPage ?? outline?.printed.get(pageNumber) ?? null;
  const unitIndex = outline?.unitOfPage.get(pageNumber);

  const pageNumbers = book ? book.pages.map((item) => item.pageNumber) : [];
  const position = pageNumbers.indexOf(pageNumber);
  const previousPage =
    position > 0 ? (pageNumbers[position - 1] ?? null) : null;
  const nextPage =
    position >= 0 ? (pageNumbers[position + 1] ?? null) : null;
  const pageHref = (target: number | null): string | null =>
    target === null ? null : `/admin/library/${bookId}/pages/${target}`;

  return (
    <AdminGate>
      <div className="mb-6 lg:mb-2">
        <Link
          href={`/admin/library/${bookId}`}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-ink)] coarse:inline-flex coarse:min-h-[44px] coarse:items-center"
        >
          ← Book pages
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 coarse:mt-0">
          <h2 className="text-2xl font-bold tracking-tight">
            Review {pageLabel(pageNumber, printedPage)}
          </h2>
          {page ? <StatusPill status={page.status} /> : null}
          {printedPage && printedPage !== String(pageNumber) ? (
            <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
              pdf {pageNumber}
            </span>
          ) : null}
          {outline && unitIndex !== undefined ? (
            <Link
              href={readingHref(bookId, outline, pageNumber)}
              className="text-sm text-[var(--text-secondary)] underline decoration-[var(--border-control)] underline-offset-4 hover:text-[var(--accent-ink)] coarse:inline-flex coarse:min-h-[44px] coarse:items-center"
            >
              Read in unit
            </Link>
          ) : null}
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {page?.status === "failed" && page.errorMessage ? (
        <Notice tone="error" className="mb-4">
          {page.errorMessage}
        </Notice>
      ) : null}
      {!page ? (
        error ? null : (
          <p className="text-[var(--text-secondary)]">Loading page…</p>
        )
      ) : (
        <PageReviewEditor
          key={`${page.id}-${page.updatedAt}`}
          bookId={bookId}
          pageNumber={pageNumber}
          rawImageUrl={page.rawImageUrl}
          initialJson={initialJson}
          previousHref={pageHref(previousPage)}
          nextHref={pageHref(nextPage)}
          retrying={retrying}
          activity={retrying ? readingNote(stage ?? page.stage) : null}
          onRetry={() => void retry()}
          onSaved={() => {
            void load();
            void refreshBook();
          }}
        />
      )}
    </AdminGate>
  );
};

export default PageReviewRoute;
