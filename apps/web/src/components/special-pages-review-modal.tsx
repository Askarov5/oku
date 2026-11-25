"use client";

import {
  collectBlockText,
  collectTocEntries,
  pageRoleLabel,
  readStoredContents,
} from "@oku/shared-types";
import type {
  ContentsEntry,
  CoverMeta,
  PageExtractedJson,
  PageRole,
} from "@oku/shared-types";
import { Button, Notice, fieldClass } from "@oku/ui";
import type { NoticeState } from "@oku/ui";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminDialog } from "@/components/admin-dialog";
import { RichText } from "@/components/rich-text";
import {
  TocOutlineEditor,
  entriesFromRows,
  rowsFromEntries,
  type TocDraftRow,
} from "@/components/toc-outline-editor";
import { readError } from "@/lib/admin-request";
import { readPageJson } from "@/lib/book-outline";
import { resolveDigitizeEnd } from "@/lib/book-page-range";
import { libraryBookPutFields } from "@/lib/catalog";
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

const TEXT_ROLES = ["cover", "glossary", "appendix", "answers"] as const;

interface TextDrafts {
  cover: string;
  glossary: string;
  appendix: string;
  answers: string;
}

const EMPTY_DRAFTS: TextDrafts = {
  cover: "",
  glossary: "",
  appendix: "",
  answers: "",
};

const DISCARD_WARNING = "Close without saving? Unsaved edits will be lost.";

const outlineSignature = (rows: TocDraftRow[]): string =>
  rows
    .map((row) => `${row.level}\t${row.title}\t${row.printedPage}`)
    .join("\n");

/** The textarea is the page's prose. Images and tables stay where they are. */
const applyTextDraft = (
  json: PageExtractedJson | null,
  pageNumber: number,
  draft: string,
): PageExtractedJson => {
  const base: PageExtractedJson = json ?? {
    pageNumber,
    printedPage: null,
    continuesFromPrevious: false,
    blocks: [],
    warnings: [],
    model: "manual",
    extractedAt: new Date().toISOString(),
  };
  const blocks: PageExtractedJson["blocks"] = [];
  let placed = false;
  for (const block of base.blocks) {
    if (block.type === "markdown" || block.type === "unit_header") {
      if (!placed) {
        placed = true;
        if (draft.trim()) {
          blocks.push({
            id: block.type === "markdown" ? block.id : crypto.randomUUID(),
            type: "markdown",
            markdown: draft,
          });
        }
      }
      continue;
    }
    blocks.push(block);
  }
  if (!placed && draft.trim()) {
    blocks.unshift({
      id: crypto.randomUUID(),
      type: "markdown",
      markdown: draft,
    });
  }
  return { ...base, pageNumber, blocks };
};

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<NoticeState | null>(null);
  const [rows, setRows] = useState<TocDraftRow[]>([]);
  const [tab, setTab] = useState<SpecialTab>("table_of_contents");
  const [coverDraft, setCoverDraft] = useState("");
  const [glossaryDraft, setGlossaryDraft] = useState("");
  const [appendixDraft, setAppendixDraft] = useState("");
  const [answersDraft, setAnswersDraft] = useState("");
  const textBaseline = useRef<TextDrafts>({ ...EMPTY_DRAFTS });
  const rowsBaseline = useRef("");

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
    return page ? readPageJson(page) : null;
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
        resolveDigitizeEnd(
          book.digitizePageEnd,
          detail.pages.map((item) => item.pageNumber),
        ) &&
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
    if (!open) {
      return;
    }
    const stored = readStoredContents(book.contentsOutline) ?? [];
    const fromPages = collectTocEntries(
      specialPages
        .filter((page) => page.pageRole === "table_of_contents")
        .map((page) => ({
          pageNumber: page.pageNumber,
          extractedJson: extractedFor(page.pageNumber),
        })),
    );
    const nextRows = rowsFromEntries(stored.length > 0 ? stored : fromPages);
    setRows(nextRows);
    rowsBaseline.current = outlineSignature(nextRows);
    setTab(tabs[0] ?? "table_of_contents");
    setMessage(null);

    const seeded: TextDrafts = { ...EMPTY_DRAFTS };
    for (const role of TEXT_ROLES) {
      const page = specialPages.find((item) => item.pageRole === role);
      seeded[role] = page ? markdownFromPage(extractedFor(page.pageNumber)) : "";
    }
    textBaseline.current = seeded;
    setCoverDraft(seeded.cover);
    setGlossaryDraft(seeded.glossary);
    setAppendixDraft(seeded.appendix);
    setAnswersDraft(seeded.answers);
    // Seed when the dialog opens; keep local edits while it stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open]);

  if (!open) {
    return null;
  }

  const textDrafts = (): TextDrafts => ({
    cover: coverDraft,
    glossary: glossaryDraft,
    appendix: appendixDraft,
    answers: answersDraft,
  });

  const saveTextDrafts = async (): Promise<boolean> => {
    const current = textDrafts();
    for (const role of TEXT_ROLES) {
      if (current[role] === textBaseline.current[role]) {
        continue;
      }
      const page = specialPages.find((item) => item.pageRole === role);
      if (!page) {
        continue;
      }
      const response = await fetch(
        `/api/admin/books/${book.id}/pages/${page.pageNumber}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            extractedJson: applyTextDraft(
              extractedFor(page.pageNumber),
              page.pageNumber,
              current[role],
            ),
            markReviewed: page.status === "reviewed",
          }),
        },
      );
      if (!response.ok) {
        setMessage({
          text: await readError(response, "Could not save the page text"),
          tone: "error",
        });
        return false;
      }
      textBaseline.current = { ...textBaseline.current, [role]: current[role] };
    }
    return true;
  };

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
        ...libraryBookPutFields(book),
        contentsOutline: parsed.entries,
      }),
    });
    if (!response.ok) {
      setMessage({
        text: await readError(response, "Could not save the contents"),
        tone: "error",
      });
      return null;
    }
    return parsed.entries;
  };

  const saveDraft = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);
    const textSaved = await saveTextDrafts();
    if (!textSaved) {
      setBusy(false);
      return;
    }
    const saved = await saveOutline();
    setBusy(false);
    if (!saved && rows.length > 0) {
      return;
    }
    rowsBaseline.current = outlineSignature(rows);
    setMessage({ text: "Draft saved", tone: "info" });
    await onSaved();
  };

  const convertBody = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);
    const textSaved = await saveTextDrafts();
    if (!textSaved) {
      setBusy(false);
      return;
    }
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
    setBusy(false);
    if (!response.ok) {
      setMessage({
        text: await readError(response, "Could not start body conversion"),
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
    if (
      !window.confirm(
        "Replace the book’s title, authors, and year with the ones read from the cover?",
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/admin/books/${book.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...libraryBookPutFields(book),
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
      setMessage({
        text: await readError(response, "Could not sync cover metadata"),
        tone: "error",
      });
      return;
    }
    setMessage({ text: "Cover metadata synced to the book", tone: "info" });
    await onSaved();
  };

  const requestClose = (): void => {
    if (busy) {
      return;
    }
    const current = textDrafts();
    const textDirty = TEXT_ROLES.some(
      (role) => current[role] !== textBaseline.current[role],
    );
    const listDirty = outlineSignature(rows) !== rowsBaseline.current;
    if ((textDirty || listDirty) && !window.confirm(DISCARD_WARNING)) {
      return;
    }
    onClose();
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

  return (
    <AdminDialog
      titleId="special-review-title"
      title="Review special pages"
      description={
        specialsPending
          ? "Special pages are still extracting…"
          : tocReady
            ? "Edit the table of contents, then approve to convert the body."
            : "Waiting for table of contents pages…"
      }
      maxWidth="5xl"
      busy={busy}
      onClose={requestClose}
      headerExtra={
        tabs.length > 0 ? (
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
          ) : null
      }
      footer={
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
            onClick={requestClose}
          >
            Close
          </Button>
        </div>
      }
    >
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
    </AdminDialog>
  );
};
