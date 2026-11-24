"use client";

import { ContentsOutlineSchema } from "@oku/shared-types";
import type { ContentsEntry, HeadingLevel } from "@oku/shared-types";
import {
  Button,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "@oku/ui";
import type { KeyboardEvent, ReactElement } from "react";

export interface TocDraftRow {
  key: string;
  title: string;
  level: HeadingLevel;
  printedPage: string;
}

interface TocOutlineEditorProps {
  rows: TocDraftRow[];
  onChange: (rows: TocDraftRow[]) => void;
  busy?: boolean;
  /** Extra actions under the list (e.g. refresh). */
  footer?: ReactElement;
}

const LEVEL_STEP = "0.75rem";
const TITLE_INPUT =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] coarse:min-h-[44px] coarse:text-base";
const PAGE_INPUT =
  "w-12 shrink-0 border-0 bg-transparent p-0 text-right font-mono text-xs tabular-nums text-[var(--text-secondary)] outline-none placeholder:text-[var(--text-secondary)] coarse:min-h-[44px] coarse:w-14 coarse:text-sm";
const ICON_HIT =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--rounded-xs)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-30";

export const nextTocKey = (): string =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const clampTocLevel = (level: number): HeadingLevel =>
  Math.min(6, Math.max(1, level)) as HeadingLevel;

export const rowsFromEntries = (entries: ContentsEntry[]): TocDraftRow[] =>
  entries.map((entry) => ({
    key: nextTocKey(),
    title: entry.title,
    level: entry.level,
    printedPage: entry.printedPage,
  }));

export const entriesFromRows = (
  rows: TocDraftRow[],
):
  | { ok: true; entries: ContentsEntry[] }
  | { ok: false; error: string } => {
  const filled = rows.filter(
    (row) => row.title.trim().length > 0 || row.printedPage.trim().length > 0,
  );
  if (filled.length === 0) {
    return { ok: false, error: "Add each contents line so it matches the pages." };
  }
  const entries = filled.map((row) => ({
    title: row.title.trim(),
    level: row.level,
    printedPage: row.printedPage.trim(),
  }));
  if (!ContentsOutlineSchema.safeParse(entries).success) {
    return { ok: false, error: "Each row needs a title and a page." };
  }
  return { ok: true, entries };
};

/**
 * Indented TOC list: edit titles/pages, Left/Right (or arrows) change level.
 */
export const TocOutlineEditor = ({
  rows,
  onChange,
  busy = false,
  footer,
}: TocOutlineEditorProps): ReactElement => {
  const patch = (key: string, next: Partial<TocDraftRow>): void => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...next } : row)));
  };

  const shiftLevel = (key: string, delta: -1 | 1): void => {
    onChange(
      rows.map((row) =>
        row.key === key
          ? { ...row, level: clampTocLevel(row.level + delta) }
          : row,
      ),
    );
  };

  const onRowKey = (key: string, event: KeyboardEvent<HTMLLIElement>): void => {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      shiftLevel(key, -1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      shiftLevel(key, 1);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {rows.length === 0 ? (
        <p className="px-2 py-3 text-sm text-[var(--text-secondary)]">
          No entries yet.
        </p>
      ) : (
        <ol className="flex flex-col px-1 py-1">
          {rows.map((row) => (
            <li
              key={row.key}
              tabIndex={0}
              onKeyDown={(event) => onRowKey(row.key, event)}
              className="flex items-center gap-0.5 border-b border-[var(--border-hairline)] py-0.5 outline-none focus-visible:bg-[var(--bg-hover)]"
              style={{
                paddingLeft: `calc(${row.level - 1} * ${LEVEL_STEP})`,
              }}
            >
              <button
                type="button"
                aria-label="Outdent"
                disabled={busy || row.level <= 1}
                className={ICON_HIT}
                onClick={() => shiftLevel(row.key, -1)}
              >
                <ChevronLeftIcon />
              </button>
              <button
                type="button"
                aria-label="Indent"
                disabled={busy || row.level >= 6}
                className={ICON_HIT}
                onClick={() => shiftLevel(row.key, 1)}
              >
                <ChevronRightIcon />
              </button>
              <input
                aria-label="Title"
                className={TITLE_INPUT}
                value={row.title}
                placeholder="Title"
                disabled={busy}
                onChange={(event) =>
                  patch(row.key, { title: event.target.value })
                }
              />
              <span
                aria-hidden="true"
                className="shrink-0 px-1 text-xs text-[var(--text-secondary)]"
              >
                —
              </span>
              <input
                aria-label="Page"
                className={PAGE_INPUT}
                value={row.printedPage}
                placeholder="p."
                inputMode="numeric"
                disabled={busy}
                onChange={(event) =>
                  patch(row.key, { printedPage: event.target.value })
                }
              />
              <button
                type="button"
                aria-label="Remove"
                disabled={busy}
                className={`${ICON_HIT} hover:text-[var(--accent-primary)]`}
                onClick={() =>
                  onChange(rows.filter((item) => item.key !== row.key))
                }
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-2 px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            onChange([
              ...rows,
              { key: nextTocKey(), title: "", level: 2, printedPage: "" },
            ])
          }
        >
          Add
        </Button>
        {footer}
      </div>
    </div>
  );
};
