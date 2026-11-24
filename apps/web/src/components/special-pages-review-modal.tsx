"use client";

import {
  PageExtractedJsonSchema,
  collectBlockText,
  pageRoleLabel,
  readStoredContents,
} from "@oku/shared-types";
import type {
  ContentsEntry,
  CoverMeta,
  HeadingLevel,
  PageExtractedJson,
  PageRole,
} from "@oku/shared-types";
import { Button, Notice, fieldClass } from "@oku/ui";
import type { NoticeState } from "@oku/ui";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RichText } from "@/components/rich-text";
import {
  TocOutlineEditor,
  entriesFromRows,
  rowsFromEntries,
  type TocDraftRow,
} from "@/components/toc-outline-editor";
import type { LibraryBook } from "@/lib/catalog";
import type { BookDetail } from "@/lib/use-book-detail";

interface SpecialPagesReviewModalProps {
  book: LibraryBook;
  detail: BookDetail;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

type SpecialTab = Exclude<PageRole, "body">;

const FIELD = `${fieldClass} mt-1`;

const TAB_ORDER: SpecialTab[] = [
  "table_of_contents",
  "cover",
  "glossary",
  "appendix",
  "answers",
];

const markdownFromPage = (json: PageExtractedJson | null): string => {
  if (!json) {
    return "";
  }
  return json.blocks
    .map((block) => {
      if (block.type === "markdown") {
        return block.markdown;
      }
      if (block.type === "unit_header") {
        return `# ${block.title}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
};

const bookPayload = (book: LibraryBook) => ({
  title: book.title,
  authors: book.authors,
  language: book.language,
  categoryId: book.categoryId,
  subcategoryId: book.subcategoryId,
  newSubcategory: "",
  schoolTextbook: book.isSchoolTextbook,
  grade: book.grade === null ? "" : String(book.grade),
  publishedYear:
    book.publishedYear === null ? "" : String(book.publishedYear),
});

/**
 * Review gate after Phase 1: edit TOC levels, inspect special pages, then
 * approve and convert body pages.
 */
export const SpecialPagesReviewModal = ({
  book,
  detail,
  open,
  onClose,
  onSaved,
}: SpecialPagesReviewModalProps): ReactElement | null => {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<NoticeState | null>(null);
  const [rows, setRows] = useState<TocDraftRow[]>([]);
  const [tab, setTab] = useState<SpecialTab>("table_of_contents");
  const [coverDraft, setCoverDraft] = useState("");
  const [glossaryDraft, setGlossaryDraft] = useState("");
  const [appendixDraft, setAppendixDraft] = useState("");
  const [answersDraft, setAnswersDraft] = useState("");

  const specialPages = useMemo(
    () =>
      detail.pages
        .filter((page) => page.pageRole !== "body")
        .sort((a, b) => a.pageNumber - b.pageNumber),
    [detail.pages],
  );

  const tabs = useMemo(() => {
    const present = new Set(specialPages.map((page) => page.pageRole as SpecialTab));
    return TAB_ORDER.filter((role) => present.has(role));
  }, [specialPages]);

  const pagesForTab = specialPages.filter((page) => page.pageRole === tab);

  const extractedFor = (pageNumber: number): PageExtractedJson | null => {
    const page = detail.pages.find((item) => item.pageNumber === pageNumber);
    if (!page?.extractedJson) {
      return null;
    }
    const parsed = PageExtractedJsonSchema.safeParse(page.extractedJson);
    return parsed.success ? parsed.data : null;
  };

  const tocReady = specialPages
    .filter((page) => page.pageRole === "table_of_contents")
    .every(
      (page) => page.status === "extracted" || page.status === "reviewed",
    );
  const specialsPending = specialPages.some(
    (page) => page.status === "pending" || page.status === "failed",
  );
  const bodyPageCount = detail.pages.filter(
    (page) =>
      page.pageRole === "body" &&
      page.pageNumber >= (book.digitizePageStart ?? 1) &&
      page.pageNumber <=
        (book.digitizePageEnd ??
          Math.max(...detail.pages.map((item) => item.pageNumber), 1)) &&
      page.status === "stored",
  ).length;

  const coverMeta: CoverMeta | null = (() => {
    const coverPage = specialPages.find((page) => page.pageRole === "cover");
    if (!coverPage) {
      return null;
    }
    return extractedFor(coverPage.pageNumber)?.coverMeta ?? null;
  })();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const stored = readStoredContents(book.contentsOutline) ?? [];
    const fromPages: ContentsEntry[] = specialPages
      .filter((page) => page.pageRole === "table_of_contents")
      .flatMap((page) => {
        const json = extractedFor(page.pageNumber);
        return (json?.tocEntries ?? []).map((entry) => ({
          title: entry.title,
          level: entry.level as HeadingLevel,
          printedPage: entry.printedPage,
        }));
      });
    setRows(rowsFromEntries(stored.length > 0 ? stored : fromPages));
    setTab(tabs[0] ?? "table_of_contents");
    setMessage(null);

    const setDraftFor = (role: SpecialTab, setter: (value: string) => void) => {
      const page = specialPages.find((item) => item.pageRole === role);
      setter(page ? markdownFromPage(extractedFor(page.pageNumber)) : "");
    };
    setDraftFor("cover", setCoverDraft);
    setDraftFor("glossary", setGlossaryDraft);
    setDraftFor("appendix", setAppendixDraft);
    setDraftFor("answers", setAnswersDraft);
    // Seed when the dialog opens; keep local edits while it stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open]);

  if (!open || !mounted) {
    return null;
  }

  const saveOutline = async (): Promise<ContentsEntry[] | null> => {
    if (rows.length === 0) {
      return readStoredContents(book.contentsOutline);
    }
    const parsed = entriesFromRows(rows);
    if (!parsed.ok) {
      setMessage({ text: parsed.error, tone: "error" });
      return null;
    }
    const response = await fetch(`/api/admin/books/${book.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...bookPayload(book),
        contentsOutline: parsed.entries,
      }),
    });
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setMessage({
        text: json.error ?? "Could not save the contents",
        tone: "error",
      });
      return null;
    }
    return parsed.entries;
  };

  const saveDraft = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);
    const saved = await saveOutline();
    setBusy(false);
    if (!saved && rows.length > 0) {
      return;
    }
    setMessage({ text: "Draft saved", tone: "info" });
    await onSaved();
  };

  const convertBody = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);
    let outline: ContentsEntry[] | null = null;
    if (rows.length > 0) {
      const parsed = entriesFromRows(rows);
      if (!parsed.ok) {
        setBusy(false);
        setMessage({ text: parsed.error, tone: "error" });
        return;
      }
      outline = parsed.entries;
    }
    const response = await fetch(`/api/admin/books/${book.id}/convert-body`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentsOutline: outline,
        markSpecialsReviewed: true,
      }),
    });
    const json = (await response.json().catch(() => ({}))) as {
      error?: string;
      bodyPageCount?: number;
    };
    setBusy(false);
    if (!response.ok) {
      setMessage({
        text: json.error ?? "Could not start body conversion",
        tone: "error",
      });
      return;
    }
    await onSaved();
    onClose();
  };

  const syncCoverMeta = async (): Promise<void> => {
    if (!coverMeta) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/admin/books/${book.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...bookPayload(book),
        title: coverMeta.title?.trim() || book.title,
        authors:
          coverMeta.authors && coverMeta.authors.length > 0
            ? coverMeta.authors
            : book.authors,
        publishedYear:
          coverMeta.publishedYear != null
            ? String(coverMeta.publishedYear)
            : book.publishedYear === null
              ? ""
              : String(book.publishedYear),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setMessage({
        text: json.error ?? "Could not sync cover metadata",
        tone: "error",
      });
      return;
    }
    setMessage({ text: "Cover metadata synced to the book", tone: "info" });
    await onSaved();
  };

  const draftForTab =
    tab === "cover"
      ? coverDraft
      : tab === "glossary"
        ? glossaryDraft
        : tab === "appendix"
          ? appendixDraft
          : tab === "answers"
            ? answersDraft
            : "";
  const setDraftForTab =
    tab === "cover"
      ? setCoverDraft
      : tab === "glossary"
        ? setGlossaryDraft
        : tab === "appendix"
          ? setAppendixDraft
          : tab === "answers"
            ? setAnswersDraft
            : null;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(18_22_28/0.6)] p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="special-review-title"
        className="flex max-h-[min(48rem,calc(100dvh-2rem))] w-full max-w-5xl flex-col rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
      >
        <div className="border-b border-[var(--border-hairline)] px-4 py-3">
          <h2 id="special-review-title" className="text-base font-semibold">
            Review special pages
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {specialsPending
              ? "Special pages are still extracting…"
              : tocReady
                ? "Edit the table of contents, then approve to convert the body."
                : "Waiting for table of contents pages…"}
          </p>
          {tabs.length > 0 ? (
            <div
              role="tablist"
              aria-label="Special page roles"
              className="mt-3 flex flex-wrap gap-2"
            >
              {tabs.map((role) => (
                <button
                  key={role}
                  type="button"
                  role="tab"
                  aria-selected={tab === role}
                  className={`rounded-[var(--rounded-xs)] px-3 py-1.5 text-sm coarse:min-h-[44px] ${
                    tab === role
                      ? "bg-[var(--accent-primary)] font-semibold text-[var(--on-accent)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                  onClick={() => setTab(role)}
                >
                  {pageRoleLabel(role)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {message ? (
            <Notice tone={message.tone} className="mb-3">
              {message.text}
            </Notice>
          ) : null}

          {tab === "table_of_contents" ? (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="grid gap-4">
                {pagesForTab.map((page) => (
                  <figure key={page.id} className="min-w-0">
                    <figcaption className="mb-2 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                      PDF page {page.pageNumber} · {page.status}
                    </figcaption>
                    {page.rawImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={page.rawImageUrl}
                        alt={`PDF page ${page.pageNumber}`}
                        className="w-full max-w-xl border border-[var(--border-hairline)] bg-white"
                      />
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">
                        Page image not ready yet.
                      </p>
                    )}
                  </figure>
                ))}
              </div>
              <div className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)]">
                <div className="border-b border-[var(--border-hairline)] px-3 py-2">
                  <h3 className="text-sm font-semibold">Contents</h3>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Left/right change heading level (H1–H6).
                  </p>
                </div>
                <TocOutlineEditor
                  rows={rows}
                  onChange={setRows}
                  busy={busy}
                />
              </div>
            </div>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="grid gap-4">
                {pagesForTab.map((page) => (
                  <figure key={page.id} className="min-w-0">
                    <figcaption className="mb-2 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                      PDF page {page.pageNumber} · {page.status}
                    </figcaption>
                    {page.rawImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={page.rawImageUrl}
                        alt={`PDF page ${page.pageNumber}`}
                        className="w-full max-w-xl border border-[var(--border-hairline)] bg-white"
                      />
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">
                        Page image not ready yet.
                      </p>
                    )}
                  </figure>
                ))}
              </div>
              <div className="space-y-3">
                {tab === "cover" && coverMeta ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-[var(--text-secondary)]">
                      Found: {[coverMeta.title, coverMeta.authors?.join(", "), coverMeta.publishedYear, coverMeta.publisher]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void syncCoverMeta()}
                    >
                      Sync cover metadata
                    </Button>
                  </div>
                ) : null}
                {setDraftForTab ? (
                  <>
                    <label className="block text-sm">
                      Markdown
                      <textarea
                        className={`${FIELD} block font-mono`}
                        rows={14}
                        value={draftForTab}
                        disabled={busy}
                        onChange={(event) =>
                          setDraftForTab(event.target.value)
                        }
                      />
                    </label>
                    {draftForTab.trim() ? (
                      <div className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] px-4 text-base leading-7">
                        <p className="pt-3 font-mono text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                          Preview
                        </p>
                        <RichText markdown={draftForTab} />
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">
                        {pagesForTab.some((page) => page.status === "pending")
                          ? "Waiting for extraction…"
                          : "No text extracted yet."}
                      </p>
                    )}
                  </>
                ) : null}
                {pagesForTab[0] ? (
                  <p className="font-mono text-xs text-[var(--text-secondary)]">
                    {collectBlockText(
                      extractedFor(pagesForTab[0].pageNumber)?.blocks ?? [],
                    ).length}{" "}
                    chars extracted
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] px-4 py-3">
          <Button
            type="button"
            disabled={busy || specialsPending || bodyPageCount === 0}
            onClick={() => void convertBody()}
          >
            {busy
              ? "Working…"
              : `Approve & convert body (${bodyPageCount})`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void saveDraft()}
          >
            Save draft
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="ml-auto"
            disabled={busy}
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
