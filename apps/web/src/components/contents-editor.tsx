"use client";

import { readStoredContents } from "@oku/shared-types";
import type { ContentsEntry, HeadingLevel } from "@oku/shared-types";
import { Button, Notice, RefreshIcon } from "@oku/ui";
import type { NoticeState } from "@oku/ui";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { AdminDialog } from "@/components/admin-dialog";
import {
  TocOutlineEditor,
  entriesFromRows,
  nextTocKey,
  rowsFromEntries,
  type TocDraftRow,
} from "@/components/toc-outline-editor";
import { failureText, readError, readJson } from "@/lib/admin-request";
import type { BookOutline } from "@/lib/book-outline";
import { libraryBookPutFields } from "@/lib/catalog";
import type { LibraryBook } from "@/lib/catalog";

interface ContentsEditorProps {
  book: LibraryBook;
  outline: BookOutline;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

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

  useEffect(() => {
    if (!open) {
      return;
    }
    setRows(seedRows(book, outline));
    setMessage(null);
    // Seed only when the dialog opens; keep local edits while it stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open]);

  if (!open) {
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
        ...libraryBookPutFields(book),
        contentsOutline: entries,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setMessage({
        text: await readError(response, "Could not save the contents"),
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
    const json = await readJson<{
      error?: string;
      entries?: ContentsEntry[];
      updatedHeaders?: number;
    }>(response);
    setBusy(false);
    if (!response.ok || !json) {
      setMessage({
        text: failureText(
          response.status,
          json?.error ?? "Could not refresh from the contents pages",
        ),
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

  return (
    <AdminDialog
      titleId="contents-editor-title"
      title="Contents"
      description="Left/right change heading level. This list drives the sidebar and body extraction hints."
      maxWidth="lg"
      onClose={onClose}
      titleAction={
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
      }
      footer={
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
      }
    >
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
          {message ? (
            <Notice tone={message.tone} className="mx-2 my-2">
              {message.text}
            </Notice>
          ) : null}
          <TocOutlineEditor rows={rows} onChange={setRows} busy={busy} />
        </div>
    </AdminDialog>
  );
};
