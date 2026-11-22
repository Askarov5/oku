"use client";

import { Button, Notice, StatusPill } from "@oku/ui";
import type { NoticeState } from "@oku/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactElement } from "react";
import { useState } from "react";
import { AdminGate } from "@/components/admin-gate";
import { BookCover } from "@/components/book-cover";
import { pageRef, unitHref, useBookOutline } from "@/lib/book-outline";
import { pageLabel, pageRangeLabel } from "@/lib/page-label";
import { useBookDetail } from "@/lib/use-book-detail";

const LOAD_FAILED: NoticeState = { text: "Failed to load book", tone: "error" };

const BookDetailPage = (): ReactElement => {
  const params = useParams<{ bookId: string }>();
  const bookId = params.bookId;
  const { data, failed, refresh } = useBookDetail(bookId, { poll: true });
  const outline = useBookOutline(data);
  const [message, setMessage] = useState<NoticeState | null>(null);
  const [busy, setBusy] = useState(false);

  const retryPage = async (pageNumber: number): Promise<void> => {
    setBusy(true);
    const response = await fetch(
      `/api/admin/books/${bookId}/pages/${pageNumber}/retry`,
      { method: "POST", body: JSON.stringify({}), headers: { "Content-Type": "application/json" } },
    );
    setBusy(false);
    if (!response.ok) {
      const json = (await response.json()) as { error?: string };
      setMessage({ text: json.error ?? "Retry failed", tone: "error" });
      return;
    }
    setMessage({ text: `Queued retry for page ${pageNumber}`, tone: "info" });
    await refresh();
  };

  const retryJob = async (jobId: string): Promise<void> => {
    setBusy(true);
    const response = await fetch(`/api/admin/jobs/${jobId}/retry`, {
      method: "POST",
    });
    setBusy(false);
    if (!response.ok) {
      setMessage({ text: "Job retry failed", tone: "error" });
      return;
    }
    setMessage({
      text: "Queued job retry for failed/extracted pages",
      tone: "info",
    });
    await refresh();
  };

  const publish = async (): Promise<void> => {
    setBusy(true);
    const response = await fetch(`/api/admin/books/${bookId}/publish`, {
      method: "POST",
    });
    const json = (await response.json()) as { unitCount?: number; error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage({ text: json.error ?? "Publish failed", tone: "error" });
      return;
    }
    setMessage({
      text: `Published ${json.unitCount} ${json.unitCount === 1 ? "unit" : "units"}`,
      tone: "info",
    });
    await refresh();
  };

  const reviewedCount = data
    ? data.pages.filter((page) => page.status === "reviewed").length
    : 0;
  const allReviewed =
    !!data && data.pages.length > 0 && reviewedCount === data.pages.length;
  const notice = message ?? (failed ? LOAD_FAILED : null);

  return (
    <AdminGate>
      {!data ? (
        failed ? (
          <Notice tone="error">{LOAD_FAILED.text}</Notice>
        ) : (
          <p className="text-[var(--text-secondary)]">Loading book…</p>
        )
      ) : (
        <div>
          {/* Book state: title, status, publish, and ingestion progress read as one group. */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href="/admin/library"
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-ink)] coarse:inline-flex coarse:min-h-[44px] coarse:items-center"
              >
                ← Library
              </Link>
              <div className="mt-2 flex items-start gap-4 coarse:mt-0">
                <BookCover
                  url={data.book.coverImageUrl}
                  className="h-24 w-[72px]"
                />
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold tracking-tight">
                    {data.book.title}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                    {data.book.language.toUpperCase()} · {data.book.subject}
                  </p>
                  {/* The uploaded file, unchanged. */}
                  <a
                    href={data.book.sourcePdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-sm text-[var(--text-secondary)] underline decoration-[var(--border-control)] underline-offset-4 hover:text-[var(--accent-ink)] coarse:min-h-[44px] coarse:items-center"
                  >
                    Original PDF
                  </a>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status={data.book.status} />
              <Button variant="ghost" onClick={() => void refresh()}>
                Refresh
              </Button>
              <Button onClick={() => void publish()} disabled={!allReviewed || busy}>
                Publish
              </Button>
            </div>
          </div>

          {notice ? (
            <Notice tone={notice.tone} className="mt-4">
              {notice.text}
            </Notice>
          ) : null}

          {data.jobs.length > 0 ? (
            <ul
              aria-label="Ingestion jobs"
              className="mt-6 divide-y divide-[var(--border-hairline)] border-y border-[var(--border-hairline)]"
            >
              {data.jobs.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
                >
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold">Ingestion</span>
                    <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                      pages {job.pageStart}-{job.pageEnd} · done{" "}
                      {job.completedPages}/{job.totalPages} · failed{" "}
                      {job.failedPages}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <StatusPill status={job.status} />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void retryJob(job.id)}
                    >
                      Retry failed
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Pages are the work on this screen: a hairline index, one cell per page. */}
          <section className="mt-11" aria-labelledby="pages-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h3 id="pages-heading" className="text-lg font-semibold">
                Pages
              </h3>
              <p className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                {reviewedCount}/{data.pages.length} reviewed
              </p>
            </div>
            {data.pages.length === 0 ? (
              <p className="mt-4 border-t border-[var(--border-hairline)] pt-4 text-sm text-[var(--text-secondary)]">
                No pages yet.
              </p>
            ) : (
              <ol className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(164px,1fr))] border-l border-t border-[var(--border-hairline)]">
                {data.pages.map((page) => (
                  <li
                    key={page.id}
                    className="relative flex flex-col gap-2 border-b border-r border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 transition-colors hover:bg-[var(--bg-hover)] active:bg-[var(--bg-hover)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/admin/library/${bookId}/pages/${page.pageNumber}`}
                        className="font-mono text-sm font-semibold tabular-nums after:absolute after:inset-0"
                      >
                        {pageLabel(
                          page.pageNumber,
                          outline?.printed.get(page.pageNumber),
                        )}
                      </Link>
                      <StatusPill status={page.status} />
                    </div>
                    {page.status === "failed" || page.status === "extracted" ? (
                      <Button
                        className="relative z-10 w-full"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void retryPage(page.pageNumber)}
                      >
                        Retry
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* The contents the pages form right now: one row per unit header, in book order. */}
          {outline && outline.units.length > 0 ? (
            <section className="mt-11" aria-labelledby="units-heading">
              <div className="flex items-baseline justify-between gap-4">
                <h3 id="units-heading" className="text-lg font-semibold">
                  Units
                </h3>
                <p className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                  {outline.units.length}{" "}
                  {outline.units.length === 1 ? "unit" : "units"} ·{" "}
                  {data.book.status === "published"
                    ? "published"
                    : "not published"}
                </p>
              </div>
              <ol className="mt-4 divide-y divide-[var(--border-hairline)] border-y border-[var(--border-hairline)]">
                {outline.units.map((unit) => (
                  <li
                    key={unit.orderIndex}
                    className="relative flex items-baseline gap-3 px-1 py-3 text-sm transition-colors hover:bg-[var(--bg-hover)] active:bg-[var(--bg-hover)]"
                  >
                    <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                      {unit.orderIndex + 1}
                    </span>
                    <Link
                      href={unitHref(bookId, unit.orderIndex)}
                      className="min-w-0 font-medium after:absolute after:inset-0"
                    >
                      {unit.header.title}
                    </Link>
                    <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                      {pageRangeLabel(
                        pageRef(outline, unit.header.pageStart),
                        pageRef(outline, unit.header.pageEnd),
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      )}
    </AdminGate>
  );
};

export default BookDetailPage;
