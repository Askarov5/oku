/*
 * On upload, every PDF page becomes a book_pages row. Only the digitize
 * range is queued for AI; the rest stay as `stored` until asked for later.
 */

export type BookPageSeedStatus = "pending" | "stored";

export interface BookPageSeed {
  pageNumber: number;
  status: BookPageSeedStatus;
  stage: "queued" | null;
}

export type DigitizeRangeResult =
  | { ok: true; pageStart: number; pageEnd: number; pages: BookPageSeed[] }
  | { ok: false; error: string };

/**
 * Builds one seed per PDF page. Blank start means 1; blank end means the last
 * page. Invalid numbers or a range outside the PDF fail.
 */
export const digitizePageSeeds = (
  totalPages: number,
  pageStartRaw: string,
  pageEndRaw: string,
): DigitizeRangeResult => {
  const pageStart = pageStartRaw ? Number(pageStartRaw) : 1;
  const pageEnd = pageEndRaw ? Number(pageEndRaw) : totalPages;

  if (
    !Number.isInteger(pageStart) ||
    !Number.isInteger(pageEnd) ||
    pageStart < 1 ||
    pageEnd > totalPages ||
    pageStart > pageEnd
  ) {
    return {
      ok: false,
      error: `invalid page range for ${totalPages}-page PDF`,
    };
  }

  const pages: BookPageSeed[] = [];
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const queued = pageNumber >= pageStart && pageNumber <= pageEnd;
    pages.push({
      pageNumber,
      status: queued ? "pending" : "stored",
      stage: queued ? "queued" : null,
    });
  }

  return { ok: true, pageStart, pageEnd, pages };
};

/** How many pages a digitize-from/through pair would send to AI, or null when the inputs are incomplete or invalid. */
export const queuedPageCount = (
  totalPages: number,
  pageStartRaw: string,
  pageEndRaw: string,
): number | null => {
  const result = digitizePageSeeds(totalPages, pageStartRaw, pageEndRaw);
  if (!result.ok) {
    return null;
  }
  return result.pageEnd - result.pageStart + 1;
};

/** Whether a 1-based PDF page sits inside the digitize range the form currently holds. */
export const pageInDigitizeRange = (
  pageNumber: number,
  totalPages: number,
  pageStartRaw: string,
  pageEndRaw: string,
): boolean | null => {
  const result = digitizePageSeeds(totalPages, pageStartRaw, pageEndRaw);
  if (!result.ok) {
    return null;
  }
  return pageNumber >= result.pageStart && pageNumber <= result.pageEnd;
};
