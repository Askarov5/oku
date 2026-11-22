import {
  headingLevel,
} from "./block-ast.js";
import type {
  HeadingLevel,
  PageBlock,
  PageExtractedJson,
  UnitContent,
} from "./block-ast.js";

export interface UnitDraft extends UnitContent {
  orderIndex: number;
}

/**
 * Turn reviewed pages into units.
 *
 * A `unit_header` block opens a unit and supplies its header; it never enters
 * the body. Every page leaves one `page_anchor` in the body, at the point
 * where that page starts, so a reader can jump to any page as in the book.
 * Content before the first unit header is collected under `fallbackTitle`.
 */
export const buildUnits = (
  pages: PageExtractedJson[],
  fallbackTitle: string,
): UnitDraft[] => {
  const drafts: UnitDraft[] = [];

  const open = (
    title: string,
    level: HeadingLevel,
    page: PageExtractedJson,
  ): UnitDraft => {
    const draft: UnitDraft = {
      orderIndex: drafts.length,
      header: {
        title,
        level,
        pageStart: page.pageNumber,
        pageEnd: page.pageNumber,
        pageStartLabel: page.printedPage,
        pageEndLabel: page.printedPage,
      },
      body: [],
    };
    drafts.push(draft);
    return draft;
  };

  const ordered = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  for (const page of ordered) {
    let anchored = false;

    // The anchor goes in front of the first thing the page contributes.
    const unitFor = (first: PageBlock | null): UnitDraft => {
      const unit = drafts[drafts.length - 1] ?? open(fallbackTitle, 1, page);
      if (anchored) {
        return unit;
      }
      anchored = true;
      const last = unit.body[unit.body.length - 1];
      unit.body.push({
        id: `page-${page.pageNumber}`,
        type: "page_anchor",
        pageNumber: page.pageNumber,
        label: page.printedPage,
        midParagraph:
          page.continuesFromPrevious &&
          last?.type === "markdown" &&
          first?.type === "markdown",
      });
      unit.header.pageEnd = page.pageNumber;
      unit.header.pageEndLabel = page.printedPage;
      return unit;
    };

    for (const block of page.blocks) {
      if (block.type === "unit_header") {
        open(block.title, headingLevel(block.title, block.level), page);
        continue;
      }
      unitFor(block).body.push(block);
    }

    // A blank page, or one holding only a unit header, still gets its anchor.
    unitFor(null);
  }

  return drafts;
};

/** The unit a reader lands in when asking for a page: the one holding that page's anchor. */
export const unitIndexForPage = (
  units: UnitContent[],
  pageNumber: number,
): number => {
  const anchored = units.findIndex((unit) =>
    unit.body.some(
      (block) =>
        block.type === "page_anchor" && block.pageNumber === pageNumber,
    ),
  );
  if (anchored >= 0) {
    return anchored;
  }
  return units.findIndex(
    (unit) =>
      unit.header.pageStart <= pageNumber && pageNumber <= unit.header.pageEnd,
  );
};
