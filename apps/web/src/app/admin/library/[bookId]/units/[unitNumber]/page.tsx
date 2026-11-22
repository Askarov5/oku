"use client";

import {
  Card,
  ChevronLeftIcon,
  ChevronRightIcon,
  Notice,
  StatusPill,
  buttonClasses,
} from "@oku/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { AdminGate } from "@/components/admin-gate";
import { UnitBody } from "@/components/unit-body";
import { pageRef, unitHref, useBookOutline } from "@/lib/book-outline";
import { pageRangeLabel } from "@/lib/page-label";
import { useBookDetail } from "@/lib/use-book-detail";

const BACK =
  "text-sm text-[var(--text-secondary)] hover:text-[var(--accent-ink)] coarse:inline-flex coarse:min-h-[44px] coarse:items-center";

/*
 * One unit, as it reads: its header above, its body below. The same header
 * is the unit's row in the contents on the left.
 */
const UnitRoute = (): ReactElement => {
  const params = useParams<{ bookId: string; unitNumber: string }>();
  const bookId = params.bookId;
  const index = Number(params.unitNumber) - 1;
  const { data, failed } = useBookDetail(bookId);
  const outline = useBookOutline(data);
  const unit = outline?.units[index] ?? null;
  const ready = unit !== null;

  // The body arrives after the first paint, so "open page 42" has to be honoured here.
  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    const scrollToHash = (): void => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id) {
        document.getElementById(id)?.scrollIntoView({ block: "start" });
      }
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [ready, index]);

  const bookHref = `/admin/library/${bookId}`;
  const previous = outline?.units[index - 1] ?? null;
  const next = outline?.units[index + 1] ?? null;

  return (
    <AdminGate>
      {!data || !outline ? (
        failed ? (
          <Notice tone="error">Failed to load book</Notice>
        ) : (
          <p className="text-[var(--text-secondary)]">Loading unit…</p>
        )
      ) : !unit ? (
        <div>
          <Link href={bookHref} className={BACK}>
            ← {data.book.title}
          </Link>
          <p className="mt-4 text-[var(--text-secondary)]">
            This book has no unit {params.unitNumber}.
          </p>
        </div>
      ) : (
        <div>
          <header className="mb-6">
            <Link href={bookHref} className={BACK}>
              ← {data.book.title}
            </Link>
            <h2 className="mt-2 text-2xl font-bold tracking-tight coarse:mt-0">
              {unit.header.title}
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
              <span>
                Unit {index + 1} of {outline.units.length}
              </span>
              <span>
                {pageRangeLabel(
                  pageRef(outline, unit.header.pageStart),
                  pageRef(outline, unit.header.pageEnd),
                )}
              </span>
              <StatusPill
                status={data.book.status}
                label={
                  data.book.status === "published" ? "published" : "not published"
                }
              />
            </p>
          </header>

          <Card padded={false} className="px-4 py-2 sm:px-10 sm:py-6">
            <article lang={data.book.language}>
              {unit.body.some((block) => block.type !== "page_anchor") ? (
                <UnitBody
                  body={unit.body}
                  pageHref={(pageNumber) => `${bookHref}/pages/${pageNumber}`}
                />
              ) : (
                <p className="py-4 text-sm text-[var(--text-secondary)]">
                  This unit has no content yet.
                </p>
              )}
            </article>
          </Card>

          <nav
            aria-label="Units"
            className="mt-6 flex flex-wrap items-stretch justify-between gap-3"
          >
            {previous ? (
              <Link
                href={unitHref(bookId, index - 1)}
                className={buttonClasses({
                  variant: "ghost",
                  className: "max-w-full justify-start text-left",
                })}
              >
                <ChevronLeftIcon className="shrink-0" />
                <span className="line-clamp-1">{previous.header.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={unitHref(bookId, index + 1)}
                className={buttonClasses({
                  variant: "ghost",
                  className: "max-w-full justify-end text-right",
                })}
              >
                <span className="line-clamp-1">{next.header.title}</span>
                <ChevronRightIcon className="shrink-0" />
              </Link>
            ) : null}
          </nav>
        </div>
      )}
    </AdminGate>
  );
};

export default UnitRoute;
