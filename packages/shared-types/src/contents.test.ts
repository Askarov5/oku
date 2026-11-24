import { describe, expect, it } from "vitest";
import {
  contentsPagesExist,
  contentsRangeInPdf,
  matchContentsEntry,
  normalizeContentsRange,
  parseContentsOutline,
  parseContentsRangeInput,
  parseContentsOutlineField,
  parseContentsText,
  applyContentsLevels,
  applyContentsOutline,
  readStoredContents,
  resolveUnitLevel,
} from "./contents.js";
import type { PageExtractedJson } from "./block-ast.js";

describe("contents range", () => {
  it("treats blank fields as unset", () => {
    expect(parseContentsRangeInput("", "")).toEqual({
      ok: true,
      range: null,
    });
    expect(normalizeContentsRange(null, null)).toBeNull();
  });

  it("requires both pages", () => {
    expect(parseContentsRangeInput("222", "").ok).toBe(false);
    expect(normalizeContentsRange(222, null)).toBeNull();
  });

  it("accepts a valid PDF range", () => {
    expect(parseContentsRangeInput("222", "223")).toEqual({
      ok: true,
      range: { start: 222, end: 223 },
    });
    expect(contentsRangeInPdf({ start: 222, end: 223 }, 250)).toBe(true);
    expect(contentsRangeInPdf({ start: 222, end: 223 }, 220)).toBe(false);
  });

  it("checks the pages exist on the book", () => {
    expect(
      contentsPagesExist({ start: 222, end: 223 }, [221, 222, 223, 224]),
    ).toBe(true);
    expect(contentsPagesExist({ start: 222, end: 223 }, [222])).toBe(false);
  });
});

describe("readStoredContents", () => {
  it("keeps a manual list and drops an empty one", () => {
    expect(
      readStoredContents([
        { title: "I. Chapter", level: 1, printedPage: "4" },
      ]),
    ).toEqual([{ title: "I. Chapter", level: 1, printedPage: "4" }]);
    expect(readStoredContents([])).toBeNull();
    expect(readStoredContents(null)).toBeNull();
  });
});

describe("parseContentsOutlineField", () => {
  it("treats a blank field as no outline", () => {
    expect(parseContentsOutlineField("")).toEqual({ ok: true, entries: null });
  });

  it("reads a confirmed list", () => {
    expect(
      parseContentsOutlineField(
        JSON.stringify([
          { title: "I. Chapter", level: 1, printedPage: "4" },
        ]),
      ),
    ).toEqual({
      ok: true,
      entries: [{ title: "I. Chapter", level: 1, printedPage: "4" }],
    });
  });

  it("rejects a row without a page", () => {
    expect(parseContentsOutlineField(JSON.stringify([{ title: "I. Chapter", level: 1 }])).ok).toBe(
      false,
    );
  });
});

describe("parseContentsText", () => {
  it("reads titles, printed pages, and nesting", () => {
    const entries = parseContentsText(
      [
        "Мазмуну",
        "I. Кыргызстандын географиясы ........ 4",
        "  1. Абалы ........ 4",
        "  2. Рельефи ........ 12",
        "II. Социалдык география ........ 40",
        "II. 1. Калктын өсүшү ........ 40",
      ].join("\n"),
    );
    expect(entries).toEqual([
      { title: "I. Кыргызстандын географиясы", level: 1, printedPage: "4" },
      { title: "1. Абалы", level: 2, printedPage: "4" },
      { title: "2. Рельефи", level: 2, printedPage: "12" },
      { title: "II. Социалдык география", level: 1, printedPage: "40" },
      { title: "II. 1. Калктын өсүшү", level: 2, printedPage: "40" },
    ]);
  });
});

describe("parseContentsOutline", () => {
  const page = (
    pageNumber: number,
    markdown: string,
  ): { pageNumber: number; extractedJson: PageExtractedJson } => ({
    pageNumber,
    extractedJson: {
      pageNumber,
      printedPage: String(pageNumber),
      continuesFromPrevious: false,
      blocks: [{ id: "m", type: "markdown", markdown }],
      warnings: [],
      model: "test",
      extractedAt: "2026-11-22T00:00:00.000Z",
    },
  });

  it("waits until the contents pages are digitized", () => {
    expect(parseContentsOutline({ start: 222, end: 223 }, [])).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(
      parseContentsOutline({ start: 222, end: 222 }, [
        { pageNumber: 222, extractedJson: null },
      ]),
    ).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects digitized pages that are not a contents list", () => {
    expect(
      parseContentsOutline({ start: 222, end: 222 }, [
        page(222, "109. 14; -7; 8. 110. 5; 8; 11."),
      ]),
    ).toEqual({ ok: false, reason: "no_lines" });
  });

  it("parses when every page has text", () => {
    const result = parseContentsOutline({ start: 222, end: 222 }, [
      page(222, "I. Chapter ........ 4\nI. 1. Lesson ........ 5"),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries.map((entry) => entry.title)).toEqual([
        "I. Chapter",
        "I. 1. Lesson",
      ]);
    }
  });
});

describe("applyContentsLevels", () => {
  it("updates matching headers and skips pinned ones", () => {
    const result = applyContentsLevels(
      [
        {
          pageNumber: 1,
          printedPage: "3",
          continuesFromPrevious: false,
          blocks: [
            { id: "a", type: "unit_header", title: "II. Chapter", level: 2 },
            {
              id: "b",
              type: "unit_header",
              title: "II. 1. Lesson",
              level: 1,
              levelPinned: true,
            },
          ],
          warnings: [],
          model: "test",
          extractedAt: "2026-11-22T00:00:00.000Z",
        },
      ],
      [
        { title: "II. Chapter", level: 1, printedPage: "3" },
        { title: "II. 1. Lesson", level: 2, printedPage: "3" },
      ],
    );
    expect(result.updatedHeaders).toBe(1);
    expect(result.pages[0]?.blocks[0]).toMatchObject({ level: 1 });
    expect(result.pages[0]?.blocks[1]).toMatchObject({
      level: 1,
      levelPinned: true,
    });
  });
});

describe("applyContentsOutline", () => {
  it("renames and relevels headers in reading order when counts match", () => {
    const result = applyContentsOutline(
      [
        {
          pageNumber: 1,
          printedPage: "3",
          continuesFromPrevious: false,
          blocks: [
            { id: "a", type: "unit_header", title: "II. Old", level: 2 },
            { id: "b", type: "unit_header", title: "II. 1. Lesson", level: 1 },
          ],
          warnings: [],
          model: "test",
          extractedAt: "2026-11-22T00:00:00.000Z",
        },
      ],
      [
        { title: "II. Chapter", level: 1, printedPage: "3" },
        { title: "II. 1. Lesson", level: 2, printedPage: "4" },
      ],
    );
    expect(result.updatedHeaders).toBe(2);
    expect(result.pages[0]?.blocks[0]).toMatchObject({
      title: "II. Chapter",
      level: 1,
      levelPinned: true,
    });
    expect(result.pages[0]?.blocks[1]).toMatchObject({
      title: "II. 1. Lesson",
      level: 2,
      levelPinned: true,
    });
  });
});

describe("resolveUnitLevel", () => {
  const entries = [
    { title: "II. Chapter", level: 1 as const, printedPage: "10" },
    { title: "II. 1. Lesson", level: 2 as const, printedPage: "10" },
  ];

  it("prefers a pinned reviewer level", () => {
    expect(resolveUnitLevel("II. Chapter", 3, true, entries)).toBe(3);
  });

  it("uses the contents level when the title matches", () => {
    expect(resolveUnitLevel("II. Chapter", 2, false, entries)).toBe(1);
    expect(matchContentsEntry("II. 1. Lesson", entries)?.level).toBe(2);
  });
});
