import { describe, expect, it } from "vitest";
import { buildOutline, findPage, readingHref } from "./book-outline";
import { pageLabel, pageRangeLabel } from "./page-label";

const stored = (
  pageNumber: number,
  printedPage: string | null,
  blocks: unknown[],
): { pageNumber: number; extractedJson: unknown } => ({
  pageNumber,
  extractedJson: {
    pageNumber,
    printedPage,
    continuesFromPrevious: false,
    blocks,
    warnings: [],
    model: "test",
    extractedAt: "2026-11-21T00:00:00.000Z",
  },
});

const pages = [
  stored(1, null, [{ id: "a", type: "markdown", markdown: "Title page" }]),
  stored(2, "3", [
    { id: "u", type: "unit_header", title: "§ 1. One" },
    { id: "b", type: "markdown", markdown: "Text" },
  ]),
  stored(3, "4", [{ id: "c", type: "markdown", markdown: "More" }]),
  { pageNumber: 4, extractedJson: null },
];

describe("buildOutline", () => {
  const outline = buildOutline(pages, "Book");

  it("groups pages into units and leaves unextracted pages out", () => {
    expect(outline.units.map((unit) => unit.header.title)).toEqual([
      "Book",
      "§ 1. One",
    ]);
    expect(outline.unitOfPage.get(3)).toBe(1);
    expect(outline.unitOfPage.has(4)).toBe(false);
  });

  it("finds a page by its printed number before its PDF position", () => {
    // Printed page 3 is the second page of the PDF.
    expect(findPage(outline, "3")).toBe(2);
    // Nothing is printed "1", so 1 means the first page of the PDF.
    expect(findPage(outline, "1")).toBe(1);
    expect(findPage(outline, "99")).toBeNull();
  });

  it("opens a page inside its unit, or on review when it has none", () => {
    expect(readingHref("book", outline, 3)).toBe(
      "/admin/library/book/units/2#page-3",
    );
    expect(readingHref("book", outline, 4)).toBe("/admin/library/book/pages/4");
  });
});

describe("page labels", () => {
  it("names a page by its printed number, else by PDF position", () => {
    expect(pageLabel(44, "42")).toBe("p.42");
    expect(pageLabel(2, null)).toBe("pdf 2");
  });

  it("collapses a printed range", () => {
    expect(
      pageRangeLabel(
        { pageNumber: 44, printedPage: "42" },
        { pageNumber: 49, printedPage: "47" },
      ),
    ).toBe("p.42–47");
  });
});
