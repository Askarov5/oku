export interface PageRef {
  /** Position in the source PDF, 1-based. */
  pageNumber: number;
  /** The number printed on the page, or null when none is recorded. */
  printedPage: string | null;
}

/**
 * The one place a textbook page becomes a label. A page is known to readers by
 * the number printed on it (`p.42`); until that is recorded, it is named by its
 * position in the source PDF (`pdf 44`) so the two are never confused.
 */
export const pageLabel = (
  pageNumber: number,
  printedPage?: string | null,
): string => (printedPage ? `p.${printedPage}` : `pdf ${pageNumber}`);

/** `p.42–47`, or a single label when the range is one page. */
export const pageRangeLabel = (start: PageRef, end: PageRef): string => {
  if (start.pageNumber === end.pageNumber) {
    return pageLabel(start.pageNumber, start.printedPage);
  }
  if (start.printedPage && end.printedPage) {
    return `p.${start.printedPage}–${end.printedPage}`;
  }
  if (!start.printedPage && !end.printedPage) {
    return `pdf ${start.pageNumber}–${end.pageNumber}`;
  }
  return `${pageLabel(start.pageNumber, start.printedPage)} – ${pageLabel(end.pageNumber, end.printedPage)}`;
};
