import { PageExtractedJsonSchema, buildUnits } from "@oku/shared-types";
import type { PageExtractedJson, UnitDraft } from "@oku/shared-types";
import { useMemo } from "react";
import type { PageRef } from "./page-label";
import type { BookDetail } from "./use-book-detail";

interface StoredPage {
  pageNumber: number;
  extractedJson: unknown;
}

export interface BookOutline {
  /** The units the book's pages form right now, whether or not they are published yet. */
  units: UnitDraft[];
  /** Printed page number by PDF position; null where none is recorded. */
  printed: Map<number, string | null>;
  /** Index of the unit that holds each page's anchor. Pages without content are absent. */
  unitOfPage: Map<number, number>;
}

/** The extracted content of a stored page, or null while it has none in the current shape. */
export const readPageJson = (page: StoredPage): PageExtractedJson | null => {
  if (!page.extractedJson) {
    return null;
  }
  const parsed = PageExtractedJsonSchema.safeParse(page.extractedJson);
  return parsed.success ? parsed.data : null;
};

export const buildOutline = (
  pages: StoredPage[],
  bookTitle: string,
): BookOutline => {
  const extracted = pages
    .map(readPageJson)
    .filter((json): json is PageExtractedJson => json !== null);

  const units = buildUnits(extracted, bookTitle);

  const printed = new Map<number, string | null>(
    pages.map((page) => [page.pageNumber, null]),
  );
  extracted.forEach((json) => printed.set(json.pageNumber, json.printedPage));

  const unitOfPage = new Map<number, number>();
  units.forEach((unit) => {
    unit.body.forEach((block) => {
      if (block.type === "page_anchor") {
        unitOfPage.set(block.pageNumber, unit.orderIndex);
      }
    });
  });

  return { units, printed, unitOfPage };
};

/**
 * "Open page 42": the printed number wins, as in the paper book; a number that
 * is printed nowhere falls back to the position in the PDF.
 */
export const findPage = (outline: BookOutline, query: string): number | null => {
  const wanted = query.trim().toLowerCase();
  if (!wanted) {
    return null;
  }
  for (const [pageNumber, printedPage] of outline.printed) {
    if (printedPage?.toLowerCase() === wanted) {
      return pageNumber;
    }
  }
  const position = Number(wanted);
  return Number.isInteger(position) && outline.printed.has(position)
    ? position
    : null;
};

export const pageRef = (outline: BookOutline, pageNumber: number): PageRef => ({
  pageNumber,
  printedPage: outline.printed.get(pageNumber) ?? null,
});

export const unitHref = (bookId: string, unitIndex: number): string =>
  `/admin/library/${bookId}/units/${unitIndex + 1}`;

export const pageAnchorId = (pageNumber: number): string => `page-${pageNumber}`;

/** Where "open page N" lands: inside its unit when it has one, else on the page's review screen. */
export const readingHref = (
  bookId: string,
  outline: BookOutline,
  pageNumber: number,
): string => {
  const unitIndex = outline.unitOfPage.get(pageNumber);
  return unitIndex === undefined
    ? `/admin/library/${bookId}/pages/${pageNumber}`
    : `${unitHref(bookId, unitIndex)}#${pageAnchorId(pageNumber)}`;
};

export const useBookOutline = (data: BookDetail | null): BookOutline | null =>
  useMemo(
    () => (data ? buildOutline(data.pages, data.book.title) : null),
    [data],
  );
