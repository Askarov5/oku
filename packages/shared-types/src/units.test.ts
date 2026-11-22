import { describe, expect, it } from "vitest";
import type { PageBlock, PageExtractedJson } from "./block-ast.js";
import { buildUnits, unitIndexForPage } from "./units.js";

const page = (
  pageNumber: number,
  blocks: PageBlock[],
  extra: Partial<PageExtractedJson> = {},
): PageExtractedJson => ({
  pageNumber,
  printedPage: String(pageNumber + 2),
  continuesFromPrevious: false,
  blocks,
  warnings: [],
  model: "test",
  extractedAt: "2026-11-21T00:00:00.000Z",
  ...extra,
});

const text = (id: string, markdown: string): PageBlock => ({
  id,
  type: "markdown",
  markdown,
});

const header = (id: string, title: string): PageBlock => ({
  id,
  type: "unit_header",
  title,
});

describe("buildUnits", () => {
  it("opens a unit at each unit header and keeps the header out of the body", () => {
    const units = buildUnits(
      [
        page(1, [header("u1", "§ 1. One"), text("a", "Intro")]),
        page(2, [text("b", "More")]),
        page(3, [header("u2", "§ 2. Two"), text("c", "Body")]),
      ],
      "Book",
    );

    expect(units.map((unit) => unit.header.title)).toEqual([
      "§ 1. One",
      "§ 2. Two",
    ]);
    expect(units[0]?.header).toMatchObject({
      pageStart: 1,
      pageEnd: 2,
      pageStartLabel: "3",
      pageEndLabel: "4",
    });
    expect(units[0]?.body.map((block) => block.type)).toEqual([
      "page_anchor",
      "markdown",
      "page_anchor",
      "markdown",
    ]);
    expect(units[1]?.body.map((block) => block.type)).toEqual([
      "page_anchor",
      "markdown",
    ]);
  });

  it("does not split units on headings inside the text", () => {
    const units = buildUnits(
      [page(1, [text("a", "# Big heading\n\nText\n\n## Smaller\n\nMore")])],
      "Book",
    );
    expect(units).toHaveLength(1);
    expect(units[0]?.header.title).toBe("Book");
  });

  it("marks an anchor that falls inside a paragraph", () => {
    const units = buildUnits(
      [
        page(1, [header("u1", "One"), text("a", "The sentence starts here and")]),
        page(2, [text("b", "ends on the next page.")], {
          continuesFromPrevious: true,
        }),
      ],
      "Book",
    );
    const anchors = units[0]?.body.filter(
      (block) => block.type === "page_anchor",
    );
    expect(anchors?.map((anchor) => anchor.midParagraph)).toEqual([false, true]);
  });

  it("shares a page between two units when a header falls mid-page", () => {
    const units = buildUnits(
      [
        page(1, [header("u1", "One"), text("a", "Start")]),
        page(2, [text("b", "End of one"), header("u2", "Two"), text("c", "Two")]),
      ],
      "Book",
    );
    expect(units[0]?.header.pageEnd).toBe(2);
    expect(units[1]?.header.pageStart).toBe(2);
    expect(unitIndexForPage(units, 2)).toBe(0);
  });

  it("keeps an anchor for a page with no content", () => {
    const units = buildUnits(
      [page(1, [header("u1", "One"), text("a", "Text")]), page(2, [])],
      "Book",
    );
    expect(unitIndexForPage(units, 2)).toBe(0);
    expect(units[0]?.header.pageEnd).toBe(2);
  });
});
