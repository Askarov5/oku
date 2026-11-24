"use client";

import { readStoredContents } from "@oku/shared-types";
import type { ContentsEntry, HeadingLevel } from "@oku/shared-types";
import { Button, Notice, RefreshIcon } from "@oku/ui";
import type { NoticeState } from "@oku/ui";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  TocOutlineEditor,
  entriesFromRows,
  nextTocKey,
  rowsFromEntries,
  type TocDraftRow,
} from "@/components/toc-outline-editor";
import type { BookOutline } from "@/lib/book-outline";
import type { LibraryBook } from "@/lib/catalog";

interface ContentsEditorProps {
  book: LibraryBook;
  outline: BookOutline;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

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

const seedRows = (book: LibraryBook, outline: BookOutline): TocDraftRow[] => {
  const fromHeaders: ContentsEntry[] = outline.body
    .filter((unit) => unit.header.title !== book.title)
    .map((unit) => ({
      title: unit.header.title,
      level: unit.header.level as HeadingLevel,
      printedPage:
        unit.header.pageStartLabel ?? String(unit.header.pageStart),
    }));
  const stored = readStoredContents(book.contentsOutline);
  const source: ContentsEntry[] =
    fromHeaders.length > 0
      ? fromHeaders
      : stored && stored.length > 0
        ? stored
        : (outline.contents ?? []);
  return rowsFromEntries(source);
};

/**
 * Edits the book's table of contents: indented list with level controls,
 * and a refresh that re-reads digitized TOC pages.
 */
export const ContentsEditor = ({
  book,
  outline,
  open,
  onClose,
  onSaved,
}: ContentsEditorProps): ReactElement | null => {
  const [rows, setRows] = useState<TocDraftRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<NoticeState | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setRows(seedRows(book, outline));
    setMessage(null);
    // Seed only when the dialog opens; keep local edits while it stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open]);

  if (!open || !mounted) {
    return null;
  }

  const save = async (clearOutline: boolean): Promise<void> => {
    const entries = clearOutline
      ? null
      : (() => {
          const parsed = entriesFromRows(rows);
          if (!parsed.ok) {
            setMessage({ text: parsed.error, tone: "error" });
            return undefined;
          }
          return parsed.entries;
        })();
    if (entries === undefined) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/admin/books/${book.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...bookPayload(book),
        contentsOutline: entries,
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage({
        text: json.error ?? "Could not save the contents",
        tone: "error",
      });
      return;
    }
    await onSaved();
    onClose();
  };

  const refreshFromPages = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);
    const response = await fetch(
      `/api/admin/books/${book.id}/contents/refresh`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    const json = (await response.json().catch(() => ({}))) as {
      error?: string;
      entries?: ContentsEntry[];
      updatedHeaders?: number;
    };
    setBusy(false);
    if (!response.ok) {
      setMessage({
        text: json.error ?? "Could not refresh from the contents pages",
        tone: "error",
      });
      return;
    }
    if (json.entries) {
      setRows(
        json.entries.map((entry) => ({
          key: nextTocKey(),
          title: entry.title,
          level: entry.level,
          printedPage: entry.printedPage,
        })),
      );
    }
    setMessage({
      text: `Updated ${json.updatedHeaders ?? 0} header ${
        (json.updatedHeaders ?? 0) === 1 ? "level" : "levels"
      } from the contents pages`,
      tone: "info",
    });
    await onSaved();
  };

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(18_22_28/0.6)] p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contents-editor-title"
        className="flex max-h-[min(40rem,calc(100dvh-2rem))] w-full max-w-lg flex-col rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
      >
        <div className="border-b border-[var(--border-hairline)] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="contents-editor-title" className="text-base font-semibold">
              Contents
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Refresh levels from contents pages"
              title="Refresh levels from contents pages"
              disabled={busy}
              onClick={() => void refreshFromPages()}
            >
              <RefreshIcon />
            </Button>
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Left/right change heading level. This list drives the sidebar and
            body extraction hints.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
          {message ? (
            <Notice tone={message.tone} className="mx-2 my-2">
              {message.text}
            </Notice>
          ) : null}
          <TocOutlineEditor rows={rows} onChange={setRows} busy={busy} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] px-4 py-3">
          <Button type="button" disabled={busy} onClick={() => void save(false)}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="ml-auto"
            disabled={busy || book.contentsOutline === null}
            onClick={() => void save(true)}
          >
            Clear saved outline
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
