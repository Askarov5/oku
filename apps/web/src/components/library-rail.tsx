"use client";

import type { BookPage } from "@oku/db";
import { Button, PencilIcon } from "@oku/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent, ReactElement, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { ContentsEditor } from "@/components/contents-editor";
import {
  findPage,
  readingHref,
  unitHref,
  unitRangeLabel,
  useBookOutline,
} from "@/lib/book-outline";
import type { BookOutline } from "@/lib/book-outline";
import { pageLabel } from "@/lib/page-label";
import { useBookDetail } from "@/lib/use-book-detail";

interface RailLocation {
  bookId: string | null;
  pageNumber: number | null;
  unitIndex: number | null;
}

interface PageRowsProps {
  bookId: string;
  pages: BookPage[];
  outline: BookOutline;
  activePage: number | null;
  activeRow: RefObject<HTMLAnchorElement | null>;
}

interface GoToPageProps {
  bookId: string;
  outline: BookOutline;
}

const BOOK_PATH =
  /^\/admin\/library\/([0-9a-f-]{36})(?:\/(pages|units)\/(\d+))?/i;

const readLocation = (pathname: string): RailLocation => {
  const match = BOOK_PATH.exec(pathname);
  const kind = match?.[2];
  const number = match?.[3] ? Number(match[3]) : null;
  return {
    bookId: match?.[1] ?? null,
    pageNumber: kind === "pages" ? number : null,
    unitIndex: kind === "units" && number !== null ? number - 1 : null,
  };
};

/* A short book shows every page; a long one opens only the unit being worked on. */
const EXPAND_ALL_UP_TO = 24;

const ROW =
  "flex min-h-[36px] items-center gap-3 rounded-[var(--rounded-xs)] px-3 py-1.5 text-sm transition-colors coarse:min-h-[44px]";
const ROW_IDLE =
  "text-[var(--text-on-rail)] hover:bg-[var(--rail-hover)] active:bg-[var(--rail-hover)]";
const ROW_ACTIVE =
  "bg-[var(--accent-primary)] font-semibold text-[var(--on-accent)]";
const GROUP_LABEL =
  "px-3 pb-1 pt-4 text-xs font-medium text-[var(--text-on-rail-muted)]";

const rowClass = (active: boolean): string =>
  `${ROW} ${active ? ROW_ACTIVE : ROW_IDLE}`;

/* Settled pages recede; pages that still need a person keep full ink. */
const statusClass = (status: BookPage["status"], active: boolean): string => {
  if (active) {
    return "";
  }
  if (status === "failed") {
    return "font-semibold text-[var(--text-on-rail)]";
  }
  if (status === "extracted") {
    return "text-[var(--text-on-rail)]";
  }
  return "text-[var(--text-on-rail-muted)]";
};

const PageRows = ({
  bookId,
  pages,
  outline,
  activePage,
  activeRow,
}: PageRowsProps): ReactElement => (
  <ol className="flex flex-col gap-px">
    {pages.map((page) => {
      const active = page.pageNumber === activePage;
      return (
        <li key={page.id}>
          <Link
            ref={active ? activeRow : undefined}
            href={`/admin/library/${bookId}/pages/${page.pageNumber}`}
            aria-current={active ? "page" : undefined}
            className={`${rowClass(active)} pl-6`}
          >
            <span className="font-mono tabular-nums">
              {pageLabel(
                page.pageNumber,
                outline.printed.get(page.pageNumber),
              )}
            </span>
            <span
              className={`ml-auto font-mono text-xs ${statusClass(page.status, active)}`.trim()}
            >
              {page.status === "stored" ? "saved" : page.status}
            </span>
          </Link>
        </li>
      );
    })}
  </ol>
);

/* "Open page 42", as with the paper book: by printed number first. */
const GoToPage = ({ bookId, outline }: GoToPageProps): ReactElement => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [missing, setMissing] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const wanted = query.trim();
    if (!wanted) {
      return;
    }
    const pageNumber = findPage(outline, wanted);
    if (pageNumber === null) {
      setMissing(wanted);
      return;
    }
    setMissing(null);
    setQuery("");
    router.push(readingHref(bookId, outline, pageNumber));
    // In the drawer, a link tap closes it; a submitted form has to ask.
    event.currentTarget.closest("dialog")?.close();
  };

  return (
    <form onSubmit={submit} className="mt-3 px-3">
      <div className="flex gap-2">
        <input
          aria-label="Go to page"
          placeholder="Go to page"
          inputMode="numeric"
          enterKeyHint="go"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setMissing(null);
          }}
          className="w-full min-w-0 rounded-[var(--rounded-xs)] border border-[var(--rail-line)] bg-transparent px-3 py-1.5 font-mono text-sm text-[var(--text-on-rail)] coarse:min-h-[44px] coarse:text-base"
        />
        <Button type="submit" variant="rail" size="sm" className="shrink-0">
          Go
        </Button>
      </div>
      {missing ? (
        <p role="status" className="mt-2 text-xs text-[var(--text-on-rail)]">
          No page {missing} in this book.
        </p>
      ) : null}
    </form>
  );
};

/*
 * The rail is the book's table of contents: reusable TOC when saved, body
 * units otherwise, plus a Front & Back Matter group for reference units.
 */
export const LibraryRail = (): ReactElement => {
  const pathname = usePathname();
  const { bookId, pageNumber, unitIndex } = readLocation(pathname);
  const { data, refresh } = useBookDetail(bookId);
  const outline = useBookOutline(data);
  const activeRow = useRef<HTMLAnchorElement | null>(null);
  const pageCount = data?.pages.length ?? 0;
  const [contentsOpen, setContentsOpen] = useState(false);

  useEffect(() => {
    activeRow.current?.scrollIntoView({ block: "nearest" });
  }, [pageNumber, unitIndex, pageCount]);

  const onIndex = pathname === "/admin/library";
  const onBook = bookId !== null && pageNumber === null && unitIndex === null;

  // The unit in view: the one being read, or the one holding the page under review.
  const openUnit =
    unitIndex ??
    (pageNumber !== null ? outline?.unitOfPage.get(pageNumber) : undefined) ??
    null;
  const expandAll = pageCount <= EXPAND_ALL_UP_TO;
  const loosePages =
    data && outline
      ? data.pages.filter((page) => !outline.unitOfPage.has(page.pageNumber))
      : [];

  const tocEntries = outline?.contents ?? null;
  const bodyUnits = outline?.body ?? [];
  const matter = outline?.matter ?? [];
  const showHeaders = bodyUnits.length > 0;

  return (
    <nav aria-label="Library" className="flex flex-col">
      <Link
        href="/admin/library"
        aria-current={onIndex ? "page" : undefined}
        className={rowClass(onIndex)}
      >
        Library
      </Link>

      {bookId && data && outline ? (
        <div className="mt-4 border-t border-[var(--rail-hover)] pt-4">
          <Link
            href={`/admin/library/${bookId}`}
            aria-current={onBook ? "page" : undefined}
            className={rowClass(onBook)}
          >
            <span lang={data.book.language}>{data.book.title}</span>
          </Link>

          {pageCount > 0 ? (
            <GoToPage bookId={bookId} outline={outline} />
          ) : null}

          {showHeaders || (tocEntries && tocEntries.length > 0) ? (
            <>
              <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-4">
                <p className="text-xs font-medium text-[var(--text-on-rail-muted)]">
                  Contents
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-[var(--text-on-rail-muted)] hover:bg-[var(--rail-hover)] hover:text-[var(--text-on-rail)]"
                  aria-label="Edit table of contents"
                  title="Edit TOC"
                  onClick={() => setContentsOpen(true)}
                >
                  <PencilIcon />
                </Button>
              </div>
              <ol className="flex flex-col gap-px">
                {showHeaders
                  ? bodyUnits.map((unit) => {
                      const active = unit.orderIndex === unitIndex;
                      const open = expandAll || unit.orderIndex === openUnit;
                      const unitPages = open
                        ? data.pages.filter(
                            (page) =>
                              outline.unitOfPage.get(page.pageNumber) ===
                              unit.orderIndex,
                          )
                        : [];
                      return (
                        <li key={unit.orderIndex}>
                          <Link
                            ref={active ? activeRow : undefined}
                            href={unitHref(bookId, unit.orderIndex)}
                            aria-current={active ? "page" : undefined}
                            className={`${rowClass(active)} items-baseline`}
                          >
                            <span
                              lang={data.book.language}
                              className="min-w-0"
                              style={{
                                marginLeft: `${(unit.header.level - 1) * 0.75}rem`,
                              }}
                            >
                              {unit.header.title}
                            </span>
                            <span
                              className={`ml-auto shrink-0 font-mono text-xs tabular-nums ${active ? "" : "text-[var(--text-on-rail-muted)]"}`.trim()}
                            >
                              {unitRangeLabel(outline, unit.header)}
                            </span>
                          </Link>
                          {unitPages.length > 0 ? (
                            <PageRows
                              bookId={bookId}
                              pages={unitPages}
                              outline={outline}
                              activePage={pageNumber}
                              activeRow={activeRow}
                            />
                          ) : null}
                        </li>
                      );
                    })
                  : tocEntries?.map((entry, index) => (
                      <li key={`${entry.title}-${entry.printedPage}-${index}`}>
                        <span
                          lang={data.book.language}
                          className={`${rowClass(false)} items-baseline`}
                          style={{
                            marginLeft: `${(entry.level - 1) * 0.75}rem`,
                          }}
                        >
                          <span className="min-w-0">{entry.title}</span>
                          <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-[var(--text-on-rail-muted)]">
                            {entry.printedPage}
                          </span>
                        </span>
                      </li>
                    ))}
              </ol>
            </>
          ) : null}

          {matter.length > 0 ? (
            <>
              <p className={GROUP_LABEL}>Front &amp; back matter</p>
              <ol className="flex flex-col gap-px">
                {matter.map((unit) => {
                  const active = unit.orderIndex === unitIndex;
                  return (
                    <li key={unit.orderIndex}>
                      <Link
                        ref={active ? activeRow : undefined}
                        href={unitHref(bookId, unit.orderIndex)}
                        aria-current={active ? "page" : undefined}
                        className={`${rowClass(active)} items-baseline`}
                      >
                        <span lang={data.book.language} className="min-w-0">
                          {unit.header.title}
                        </span>
                        <span
                          className={`ml-auto shrink-0 font-mono text-xs tabular-nums ${active ? "" : "text-[var(--text-on-rail-muted)]"}`.trim()}
                        >
                          {unitRangeLabel(outline, unit.header)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}

          {loosePages.length > 0 ? (
            <>
              <p className={GROUP_LABEL}>
                {showHeaders || (tocEntries && tocEntries.length > 0)
                  ? "Not in a unit yet"
                  : "Pages"}
              </p>
              <PageRows
                bookId={bookId}
                pages={loosePages}
                outline={outline}
                activePage={pageNumber}
                activeRow={activeRow}
              />
            </>
          ) : null}

          <ContentsEditor
            book={data.book}
            outline={outline}
            open={contentsOpen}
            onClose={() => setContentsOpen(false)}
            onSaved={refresh}
          />
        </div>
      ) : null}
    </nav>
  );
};
