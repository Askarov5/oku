import { describe, expect, it } from "vitest";
import {
  matchContentsEntry,
  parseContentsText,
  applyContentsOutline,
  readStoredContents,
  resolveUnitLevel,
} from "./contents.js";

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
