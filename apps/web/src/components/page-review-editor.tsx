"use client";

import { mergeAdjacentMarkdown } from "@oku/shared-types";
import { headingLevel } from "@oku/shared-types";
import type { HeadingLevel, PageBlock, PageExtractedJson, TableBlock } from "@oku/shared-types";
import {
  Button,
  Card,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  Notice,
  buttonClasses,
  fieldClass,
} from "@oku/ui";
import type { NoticeState } from "@oku/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { useRef, useState } from "react";
import { RichText } from "@/components/rich-text";
import { TableView } from "@/components/table-view";
import { modelLabel } from "@/lib/extraction-model";

interface PageReviewEditorProps {
  bookId: string;
  pageNumber: number;
  rawImageUrl: string | null;
  initialJson: PageExtractedJson | null;
  /** Neighbouring pages of the same book; null at either end or while unknown. */
  previousHref: string | null;
  nextHref: string | null;
  /** The page is being read again; the new text replaces this when it is ready. */
  retrying: boolean;
  /** What the re-read is doing right now, shown in place of the editor's own notice. */
  activity: string | null;
  onRetry: () => void;
  onSaved: () => void;
}

interface PagerLinkProps {
  href: string | null;
  direction: "previous" | "next";
}

const emptyPage = (pageNumber: number): PageExtractedJson => ({
  pageNumber,
  printedPage: null,
  continuesFromPrevious: false,
  blocks: [],
  warnings: [],
  model: "manual",
  extractedAt: new Date().toISOString(),
});

const BLOCK_NAME: Record<PageBlock["type"], string> = {
  markdown: "Text",
  image: "Image",
  unit_header: "Unit header",
  table: "Table",
};

const FIELD = fieldClass;
const TOOL = "px-2 coarse:min-w-[44px]";

const isEmpty = (block: PageBlock): boolean => {
  switch (block.type) {
    case "markdown":
      return block.markdown.trim() === "";
    case "unit_header":
      return block.title.trim() === "";
    case "table":
      return (
        (block.caption ?? "").trim() === "" &&
        block.rows.every((row) => row.cells.every((cell) => cell.text.trim() === ""))
      );
    default:
      return false;
  }
};

/* Tall enough to read the page's prose without an inner scrollbar, within reason. */
const textRows = (markdown: string): number => {
  const lines = markdown.split("\n");
  const wrapped = lines.reduce(
    (total, line) => total + Math.max(1, Math.ceil(line.length / 64)),
    0,
  );
  return Math.min(30, Math.max(5, wrapped + 1));
};

/* Icon-only on phones, labelled from sm. An end of the book keeps its slot, dimmed. */
const PagerLink = ({ href, direction }: PagerLinkProps): ReactElement => {
  const label = direction === "previous" ? "Previous" : "Next";
  const content = (
    <>
      {direction === "previous" ? <ChevronLeftIcon /> : null}
      <span className="hidden sm:inline">{label}</span>
      {direction === "next" ? <ChevronRightIcon /> : null}
    </>
  );

  if (!href) {
    return (
      <span
        aria-hidden="true"
        className={buttonClasses({
          variant: "ghost",
          size: "icon",
          className: "opacity-40",
        })}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={`${label} page`}
      className={buttonClasses({ variant: "ghost", size: "icon" })}
    >
      {content}
    </Link>
  );
};

export const PageReviewEditor = ({
  bookId,
  pageNumber,
  rawImageUrl,
  initialJson,
  previousHref,
  nextHref,
  retrying,
  activity,
  onRetry,
  onSaved,
}: PageReviewEditorProps): ReactElement => {
  const [json, setJson] = useState<PageExtractedJson>(
    initialJson ?? emptyPage(pageNumber),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<NoticeState | null>(null);
  // Text areas by block id. A text area keeps its caret after losing focus,
  // so "Split at cursor" reads the position when the button is pressed.
  const areas = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const setBlocks = (update: (blocks: PageBlock[]) => PageBlock[]): void =>
    setJson((current) => ({ ...current, blocks: update(current.blocks) }));

  const updateTable = (
    id: string,
    update: (table: TableBlock) => TableBlock,
  ): void =>
    setJson((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === id && block.type === "table" ? update(block) : block,
      ),
    }));

  const patchBlock = (id: string, patch: Partial<PageBlock>): void =>
    setBlocks((blocks) =>
      blocks.map((block) =>
        block.id === id ? ({ ...block, ...patch } as PageBlock) : block,
      ),
    );

  const moveBlock = (id: string, delta: -1 | 1): void =>
    setBlocks((blocks) => {
      const from = blocks.findIndex((block) => block.id === id);
      const to = from + delta;
      const moved = blocks[from];
      if (!moved || to < 0 || to >= blocks.length) {
        return blocks;
      }
      const next = [...blocks];
      next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const removeBlock = (block: PageBlock): void => {
    if (
      !isEmpty(block) &&
      !window.confirm(`Remove this ${BLOCK_NAME[block.type].toLowerCase()} block?`)
    ) {
      return;
    }
    setBlocks((blocks) => blocks.filter((item) => item.id !== block.id));
  };

  const addBlock = (block: PageBlock): void =>
    setBlocks((blocks) => [...blocks, block]);

  // Cut a text block in two at the caret, so a component can go between the halves.
  const splitBlock = (id: string): void => {
    const block = json.blocks.find((item) => item.id === id);
    const at = areas.current[id]?.selectionStart;
    if (!block || block.type !== "markdown") {
      return;
    }
    if (at === undefined || at <= 0 || at >= block.markdown.length) {
      setMessage({
        text: "Place the cursor inside the text where it should split.",
        tone: "info",
      });
      return;
    }
    setMessage(null);
    setBlocks((blocks) =>
      blocks.flatMap((item) =>
        item.id === id
          ? [
              { ...block, markdown: block.markdown.slice(0, at).trimEnd() },
              {
                id: crypto.randomUUID(),
                type: "markdown" as const,
                markdown: block.markdown.slice(at).trimStart(),
              },
            ]
          : [item],
      ),
    );
  };

  const save = async (markReviewed: boolean): Promise<void> => {
    if (
      json.blocks.some((block) => block.type === "unit_header" && isEmpty(block))
    ) {
      setMessage({
        text: "Give the unit header a title, or remove it.",
        tone: "error",
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    // Text left side by side is one run of text; only components separate it.
    const extractedJson: PageExtractedJson = {
      ...json,
      blocks: mergeAdjacentMarkdown(
        json.blocks
          .filter((block) => !isEmpty(block))
          .map((block) =>
            block.type === "unit_header"
              ? { ...block, level: headingLevel(block.title, block.level) }
              : block,
          ),
      ),
    };
    const response = await fetch(
      `/api/admin/books/${bookId}/pages/${pageNumber}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedJson, markReviewed }),
      },
    );
    const data = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage({ text: data.error ?? "Save failed", tone: "error" });
      return;
    }
    setMessage({
      text: markReviewed ? "Marked reviewed" : "Saved",
      tone: "info",
    });
    onSaved();
  };

  return (
    <div className="flex flex-col gap-6">
      {/*
       * Review bar: page-to-page movement and the two saves, always in reach.
       * From lg it pins to the top; its 69px height (44px buttons, 24px
       * padding, 1px rule) sets the sticky offset of the page image below:
       * 69 + 24px gap = 93px. Under lg it pins to the bottom edge, in thumb
       * reach. On short landscape screens the bar lets go: stacked, the page
       * image takes the full width (a height cap would shrink it to a stamp);
       * side by side, it pins 24px from the top instead of under the bar.
       */}
      <div className="sticky bottom-0 z-10 order-last flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 short:static lg:bottom-auto lg:top-0 lg:order-first lg:gap-x-3 lg:border-b lg:border-t-0 lg:pb-3">
        <nav aria-label="Pages of this book" className="flex gap-2">
          <PagerLink href={previousHref} direction="previous" />
          <PagerLink href={nextHref} direction="next" />
        </nav>
        {activity ? (
          <Notice className="order-first basis-full lg:order-none lg:ml-1 lg:basis-auto">
            {activity}
          </Notice>
        ) : message ? (
          <Notice
            tone={message.tone}
            className="order-first basis-full lg:order-none lg:ml-1 lg:basis-auto"
          >
            {message.text}
          </Notice>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button
            variant="ghost"
            className="max-sm:px-3"
            disabled={busy || retrying}
            onClick={onRetry}
          >
            {retrying ? "Reading…" : "Retry"}
          </Button>
          <Button
            variant="ghost"
            className="max-sm:px-3"
            disabled={busy || retrying}
            onClick={() => void save(false)}
          >
            Save
          </Button>
          <Button
            className="max-sm:px-3"
            disabled={busy || retrying}
            onClick={() => void save(true)}
          >
            Mark reviewed
          </Button>
        </div>
      </div>

      {/* Source beside extraction from lg; stacked below it, where each needs the full width to be legible. */}
      <div
        className={`grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] ${retrying ? "opacity-60" : ""}`}
        aria-busy={retrying}
      >
        <Card
          padded={false}
          className="overflow-hidden lg:sticky lg:top-[93px] lg:short:top-6"
        >
          <div className="flex min-h-[45px] items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-4">
            <h3 className="text-sm font-semibold">Page image</h3>
            {rawImageUrl ? (
              <a
                href={rawImageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center text-sm text-[var(--text-secondary)] underline decoration-[var(--border-control)] underline-offset-4 hover:text-[var(--accent-ink)]"
              >
                Open full size
              </a>
            ) : null}
          </div>
          <div className="bg-[var(--bg-canvas)] p-4">
            {rawImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={rawImageUrl}
                alt={`Page ${pageNumber}`}
                className="mx-auto max-h-[70vh] w-full object-contain short:max-h-none lg:max-h-[calc(100dvh-194px)] lg:short:max-h-[calc(100dvh-125px)]"
              />
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                Page image not ready yet.
              </p>
            )}
          </div>
        </Card>

        <div className="min-w-0">
          {json.warnings.length > 0 ? (
            <ul className="mb-4 space-y-1 rounded-[var(--rounded-xs)] border border-[var(--status-failed)] px-4 py-3 text-sm text-[var(--status-failed)]">
              {json.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <Card padded={false} className="overflow-hidden">
            <div className="flex min-h-[45px] items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-4">
              <h3 className="text-sm font-semibold">Page content</h3>
              <span className="font-mono text-xs text-[var(--text-secondary)]">
                {modelLabel(json.model)}
              </span>
            </div>

            {/* What makes this page findable and joinable: its printed number, and whether its text carries over. */}
            <div className="grid gap-x-6 gap-y-4 border-b border-[var(--border-hairline)] px-4 py-4 sm:grid-cols-[160px_minmax(0,1fr)]">
              <label className="block text-sm">
                Printed page
                <input
                  className={`${FIELD} mt-1 font-mono`}
                  value={json.printedPage ?? ""}
                  placeholder="none"
                  onChange={(event) =>
                    setJson((current) => ({
                      ...current,
                      printedPage: event.target.value.trim() || null,
                    }))
                  }
                />
              </label>
              <label className="flex items-start gap-3 text-sm sm:pt-6">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-primary)] coarse:h-5 coarse:w-5"
                  checked={json.continuesFromPrevious}
                  onChange={(event) =>
                    setJson((current) => ({
                      ...current,
                      continuesFromPrevious: event.target.checked,
                    }))
                  }
                />
                <span>
                  Starts mid-paragraph
                  <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">
                    The first text continues a paragraph from the previous
                    page.
                  </span>
                </span>
              </label>
            </div>

            {json.blocks.length === 0 ? (
              <p className="px-4 py-4 text-sm text-[var(--text-secondary)]">
                Nothing on this page yet. Add text below.
              </p>
            ) : (
              <ol className="divide-y divide-[var(--border-hairline)]">
                {json.blocks.map((block, index) => {
                  const name = BLOCK_NAME[block.type];
                  return (
                    <li key={block.id} className="px-4 py-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                          {name}
                        </p>
                        <div className="flex items-center gap-1">
                          {block.type === "markdown" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => splitBlock(block.id)}
                            >
                              Split at cursor
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={TOOL}
                            aria-label={`Move ${name.toLowerCase()} up`}
                            disabled={index === 0}
                            onClick={() => moveBlock(block.id, -1)}
                          >
                            <ChevronUpIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={TOOL}
                            aria-label={`Move ${name.toLowerCase()} down`}
                            disabled={index === json.blocks.length - 1}
                            onClick={() => moveBlock(block.id, 1)}
                          >
                            <ChevronDownIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={TOOL}
                            aria-label={`Remove ${name.toLowerCase()}`}
                            onClick={() => removeBlock(block)}
                          >
                            <CloseIcon />
                          </Button>
                        </div>
                      </div>

                      {block.type === "markdown" ? (
                        <div className="space-y-3">
                          <textarea
                            aria-label="Text (Markdown)"
                            className={`${FIELD} block font-mono`}
                            rows={textRows(block.markdown)}
                            value={block.markdown}
                            ref={(element) => {
                              areas.current[block.id] = element;
                            }}
                            onChange={(event) =>
                              patchBlock(block.id, {
                                markdown: event.target.value,
                              })
                            }
                          />
                          {block.markdown.trim() ? (
                            <div className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] px-4 text-base leading-7">
                              <p className="pt-3 font-mono text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                                Preview
                              </p>
                              <RichText markdown={block.markdown} />
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {block.type === "table" ? (
                        <div className="space-y-3">
                          <label className="block text-sm">
                            Caption
                            <input
                              className={`${FIELD} mt-1`}
                              value={block.caption ?? ""}
                              placeholder="none"
                              onChange={(event) =>
                                updateTable(block.id, (table) => ({
                                  ...table,
                                  caption: event.target.value.trim() || null,
                                }))
                              }
                            />
                          </label>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                              <tbody>
                                {block.rows.map((row, rowIndex) => (
                                  <tr key={`${block.id}-${rowIndex}`}>
                                    {row.cells.map((cell, cellIndex) => (
                                      <td
                                        key={`${block.id}-${rowIndex}-${cellIndex}`}
                                        className="border border-[var(--border-hairline)] p-1 align-top"
                                      >
                                        <input
                                          aria-label={
                                            row.header ? "Header cell" : "Cell"
                                          }
                                          className={`${FIELD} font-sans`}
                                          value={cell.text}
                                          onChange={(event) =>
                                            updateTable(block.id, (table) => ({
                                              ...table,
                                              rows: table.rows.map((item, itemIndex) =>
                                                itemIndex !== rowIndex
                                                  ? item
                                                  : {
                                                      ...item,
                                                      cells: item.cells.map(
                                                        (entry, entryIndex) =>
                                                          entryIndex !== cellIndex
                                                            ? entry
                                                            : {
                                                                ...entry,
                                                                text: event.target.value,
                                                              },
                                                      ),
                                                    },
                                              ),
                                            }))
                                          }
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <TableView caption={block.caption} rows={block.rows} />
                        </div>
                      ) : null}

                      {block.type === "unit_header" ? (
                        <>
                          <div className="flex items-start gap-2">
                            <label className="block min-w-0 flex-1 text-sm">
                              Title
                              <input
                                aria-label="Unit title"
                                className={`${FIELD} mt-1 font-semibold`}
                                value={block.title}
                                placeholder="Unit title"
                                onChange={(event) =>
                                  patchBlock(block.id, {
                                    title: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="block w-20 shrink-0 text-sm">
                              Level
                              <select
                                aria-label="Heading level"
                                className={`${FIELD} mt-1 font-mono`}
                                value={headingLevel(block.title, block.level)}
                                onChange={(event) =>
                                  patchBlock(block.id, {
                                    level: Number(event.target.value) as HeadingLevel,
                                  })
                                }
                              >
                                {[1, 2, 3, 4, 5, 6].map((level) => (
                                  <option key={level} value={level}>
                                    H{level}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <p className="mt-2 text-xs text-[var(--text-secondary)]">
                            H1 is a chapter, H2 a lesson, H3–H6 a subsection.
                            It starts a unit and is indented in the contents.
                            The title is not repeated in the text.
                          </p>
                        </>
                      ) : null}

                      {block.type === "image" ? (
                        <div className="space-y-3">
                          {block.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={block.url}
                              alt={block.alt}
                              loading="lazy"
                              decoding="async"
                              className="max-h-40 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] object-contain"
                            />
                          ) : null}
                          <label className="block text-sm">
                            Alt
                            <input
                              className={`${FIELD} mt-1`}
                              value={block.alt}
                              onChange={(event) =>
                                patchBlock(block.id, {
                                  alt: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="block text-sm">
                            Caption
                            <input
                              className={`${FIELD} mt-1`}
                              value={block.caption ?? ""}
                              onChange={(event) =>
                                patchBlock(block.id, {
                                  caption: event.target.value || null,
                                })
                              }
                            />
                          </label>
                          <label className="block text-sm">
                            AI description
                            <textarea
                              className={`${FIELD} mt-1 block`}
                              rows={3}
                              value={block.ai_description}
                              onChange={(event) =>
                                patchBlock(block.id, {
                                  ai_description: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="flex flex-wrap gap-2 border-t border-[var(--border-hairline)] px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  addBlock({
                    id: crypto.randomUUID(),
                    type: "markdown",
                    markdown: "",
                  })
                }
              >
                Add text
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  addBlock({
                    id: crypto.randomUUID(),
                    type: "unit_header",
                    title: "",
                    level: 2,
                  })
                }
              >
                Add unit header
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  addBlock({
                    id: crypto.randomUUID(),
                    type: "table",
                    caption: null,
                    rows: [
                      {
                        header: true,
                        cells: [{ text: "" }, { text: "" }],
                      },
                      {
                        header: false,
                        cells: [{ text: "" }, { text: "" }],
                      },
                    ],
                  })
                }
              >
                Add table
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
