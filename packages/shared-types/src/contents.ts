import {
  TocEntrySchema,
  headingLevel,
  inferHeadingLevel,
  type HeadingLevel,
  type PageBlock,
  type PageExtractedJson,
} from "./block-ast.js";

/** One line from the printed table of contents. Same shape as a page's tocEntries. */
export interface ContentsEntry {
  title: string;
  level: HeadingLevel;
  printedPage: string;
}

export const ContentsEntrySchema = TocEntrySchema;

export const ContentsOutlineSchema = TocEntrySchema.array();

/** A saved manual outline, or null when the value is empty or not that shape. */
export const readStoredContents = (value: unknown): ContentsEntry[] | null => {
  const parsed = ContentsOutlineSchema.safeParse(value);
  if (!parsed.success || parsed.data.length === 0) {
    return null;
  }
  return parsed.data.map((entry) => ({
    title: entry.title,
    printedPage: entry.printedPage,
    level: entry.level as HeadingLevel,
  }));
};

export type ContentsParseResult =
  | { ok: true; entries: ContentsEntry[] }
  | { ok: false; reason: "unset" | "missing" | "empty" | "no_lines" };

const TITLE_NUMBER =
  /^((?:§\s*\d+\.?|(?:[IVXLCІХ]+|\d+)\.)(?:\s*\d+\.)*)\s*(.*)$/i;

/** Dot leaders, an ellipsis, or a run of spaces before a page number. */
const CONTENTS_LINE =
  /^(\s*)(.+?)(?:\s*(?:\.{2,}|…|\s{2,})\s*)(\d+[a-zа-я]?)\s*$/i;

const cleanTitle = (raw: string): string => raw.replace(/\s+/g, " ").trim();

const titleKey = (title: string): string => cleanTitle(title).toLowerCase();

/**
 * Level from how the contents nests: indent first, then numbering that
 * restarts under a chapter (a bare "1." after "I.") is a lesson.
 */
const nestLevel = (
  title: string,
  indent: number,
  previous: ContentsEntry[],
): HeadingLevel => {
  const match = title.match(TITLE_NUMBER);
  const number = match?.[1] ?? "";
  const parts = number
    ? number.split(".").map((part) => part.trim()).filter(Boolean)
    : [];

  if (indent >= 4) {
    return Math.min(6, Math.max(2, parts.length || 2)) as HeadingLevel;
  }
  if (indent >= 2) {
    return Math.min(6, Math.max(2, parts.length || 2)) as HeadingLevel;
  }

  if (!number) {
    return 2;
  }
  if (number.trim().startsWith("§")) {
    return 2;
  }

  if (parts.length >= 2) {
    return Math.min(6, parts.length) as HeadingLevel;
  }

  // A single Arabic numeral under a Roman chapter is a lesson.
  const arabic = /^\d+$/.test(parts[0] ?? "");
  if (arabic) {
    const parent = [...previous]
      .reverse()
      .find((entry) => entry.level === 1);
    if (parent) {
      return 2;
    }
  }

  return inferHeadingLevel(title);
};

const collectText = (blocks: PageBlock[]): string =>
  blocks
    .map((block) => {
      switch (block.type) {
        case "markdown":
          return block.markdown;
        case "unit_header":
          return block.title;
        case "table":
          return [
            block.caption ?? "",
            ...block.rows.flatMap((row) =>
              row.cells.map((cell) => cell.text),
            ),
          ].join("\n");
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n");

/** Parse contents lines from one page's text. */
export const parseContentsText = (text: string): ContentsEntry[] => {
  const entries: ContentsEntry[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\u00a0/g, " ");
    const match = line.match(CONTENTS_LINE);
    if (!match) {
      continue;
    }
    const indent = match[1]?.length ?? 0;
    const title = cleanTitle(match[2] ?? "");
    const printedPage = (match[3] ?? "").trim();
    if (!title || !printedPage) {
      continue;
    }
    // Drop the heading of the contents itself.
    if (/^(мазмуну|содержание|оглавление|contents)$/i.test(title)) {
      continue;
    }
    entries.push({
      title,
      level: nestLevel(title, indent, entries),
      printedPage,
    });
  }
  return entries;
};

/**
 * Prefer structured tocEntries from a page extraction; fall back to parsing
 * Markdown / unit_header text for older extracts.
 */
export const entriesFromExtractedPage = (
  page: PageExtractedJson,
): ContentsEntry[] => {
  if (page.tocEntries && page.tocEntries.length > 0) {
    return page.tocEntries.map((entry) => ({
      title: entry.title,
      level: entry.level as HeadingLevel,
      printedPage: entry.printedPage,
    }));
  }
  return parseContentsText(collectText(page.blocks));
};

/**
 * Merge TOC entries from an ordered list of digitized pages (preferring
 * structured tocEntries). Empty when nothing looks like a contents line.
 */
export const collectTocEntries = (
  pages: Array<{ pageNumber: number; extractedJson: PageExtractedJson | null }>,
): ContentsEntry[] => {
  const ordered = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  return ordered.flatMap((page) =>
    page.extractedJson ? entriesFromExtractedPage(page.extractedJson) : [],
  );
};

/**
 * Build the outline from an explicit list of TOC page numbers (non-contiguous
 * allowed).
 */
export const parseContentsOutlineFromPages = (
  pageNumbers: number[],
  pages: Array<{ pageNumber: number; extractedJson: PageExtractedJson | null }>,
): ContentsParseResult => {
  if (pageNumbers.length === 0) {
    return { ok: false, reason: "unset" };
  }
  const byNumber = new Map(
    pages.map((page) => [page.pageNumber, page] as const),
  );
  const slice: Array<{
    pageNumber: number;
    extractedJson: PageExtractedJson;
  }> = [];
  for (const pageNumber of pageNumbers) {
    const page = byNumber.get(pageNumber);
    if (!page) {
      return { ok: false, reason: "missing" };
    }
    if (!page.extractedJson) {
      return { ok: false, reason: "empty" };
    }
    slice.push({
      pageNumber: page.pageNumber,
      extractedJson: page.extractedJson,
    });
  }
  const entries = collectTocEntries(slice);
  if (entries.length === 0) {
    return { ok: false, reason: "no_lines" };
  }
  return { ok: true, entries };
};

/** Find a contents entry whose title matches a unit header. */
export const matchContentsEntry = (
  title: string,
  entries: ContentsEntry[],
): ContentsEntry | undefined => {
  const key = titleKey(title);
  const exact = entries.find((entry) => titleKey(entry.title) === key);
  if (exact) {
    return exact;
  }
  // Allow a header that drops or adds a trailing period on the number.
  return entries.find((entry) => {
    const a = titleKey(entry.title).replace(/\.\s+/g, ". ");
    const b = key.replace(/\.\s+/g, ". ");
    return a === b;
  });
};

/** Level for a unit header: pinned reviewer level, else contents, else title. */
export const resolveUnitLevel = (
  title: string,
  level: number | null | undefined,
  levelPinned: boolean | undefined,
  entries: ContentsEntry[] | null,
): HeadingLevel => {
  if (levelPinned && typeof level === "number" && level >= 1 && level <= 6) {
    return level as HeadingLevel;
  }
  if (entries) {
    const entry = matchContentsEntry(title, entries);
    if (entry) {
      return entry.level;
    }
  }
  return headingLevel(title, level);
};

interface HeaderLocation {
  pageIndex: number;
  blockIndex: number;
}

const headerLocations = (pages: PageExtractedJson[]): HeaderLocation[] => {
  const locations: HeaderLocation[] = [];
  pages.forEach((page, pageIndex) => {
    page.blocks.forEach((block, blockIndex) => {
      if (block.type === "unit_header") {
        locations.push({ pageIndex, blockIndex });
      }
    });
  });
  return locations;
};

/**
 * Write a saved contents list onto unit headers.
 * Same length: pair in reading order, so a renamed title still lands.
 * Otherwise match by title. Sets levelPinned so a later inference leaves the edit.
 */
export const applyContentsOutline = (
  pages: PageExtractedJson[],
  entries: ContentsEntry[],
): { pages: PageExtractedJson[]; updatedHeaders: number } => {
  const locations = headerLocations(pages);
  const pairs: Array<HeaderLocation & { entry: ContentsEntry }> = [];

  if (locations.length > 0 && locations.length === entries.length) {
    locations.forEach((location, index) => {
      const entry = entries[index];
      if (entry) {
        pairs.push({ ...location, entry });
      }
    });
  } else {
    const used = new Set<number>();
    for (const location of locations) {
      const block = pages[location.pageIndex]?.blocks[location.blockIndex];
      if (!block || block.type !== "unit_header") {
        continue;
      }
      const entryIndex = entries.findIndex(
        (entry, index) =>
          !used.has(index) && matchContentsEntry(block.title, [entry]),
      );
      const entry = entryIndex >= 0 ? entries[entryIndex] : undefined;
      if (!entry || entryIndex < 0) {
        continue;
      }
      used.add(entryIndex);
      pairs.push({ ...location, entry });
    }
  }

  if (pairs.length === 0) {
    return { pages, updatedHeaders: 0 };
  }

  const touchedPages = new Set(pairs.map((pair) => pair.pageIndex));
  let updatedHeaders = 0;
  const next = pages.map((page, pageIndex) => {
    if (!touchedPages.has(pageIndex)) {
      return page;
    }
    const blocks = page.blocks.map((block, blockIndex) => {
      const pair = pairs.find(
        (item) => item.pageIndex === pageIndex && item.blockIndex === blockIndex,
      );
      if (!pair || block.type !== "unit_header") {
        return block;
      }
      if (
        block.title === pair.entry.title &&
        block.level === pair.entry.level &&
        block.levelPinned
      ) {
        return block;
      }
      updatedHeaders += 1;
      return {
        ...block,
        title: pair.entry.title,
        level: pair.entry.level,
        levelPinned: true,
      };
    });
    return { ...page, blocks };
  });
  return { pages: next, updatedHeaders };
};
