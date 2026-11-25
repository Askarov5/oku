/*
 * On upload, every PDF page becomes a book_pages row. Only the digitize
 * range is queued for AI; the rest stay as `stored` until asked for later.
 * When special page roles are set, Phase 1 queues only those specials and
 * defers body pages until convert-body.
 */

import type { PageRole, SpecialPageRole } from "@oku/shared-types";

export type BookPageSeedStatus = "pending" | "stored";

export interface BookPageSeed {
  pageNumber: number;
  status: BookPageSeedStatus;
  stage: "queued" | null;
  pageRole: PageRole;
}

export type DigitizeRangeResult =
  | {
      ok: true;
      pageStart: number;
      pageEnd: number;
      pages: BookPageSeed[];
      /** Pages queued in Phase 1 (specials, or the full digitize range). */
      queuedPages: number[];
      /** False when specials run first and body waits for review. */
      bodyConversionQueued: boolean;
    }
  | { ok: false; error: string };

/**
 * Builds one seed per PDF page. Blank start means 1; blank end means the last
 * page. When specialRoles is non-empty, only those pages are pending; body
 * pages in the digitize range stay stored until convert-body.
 */
export const digitizePageSeeds = (
  totalPages: number,
  pageStartRaw: string,
  pageEndRaw: string,
  specialRoles: ReadonlyMap<number, SpecialPageRole> = new Map(),
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

  const hasSpecials = specialRoles.size > 0;
  const pages: BookPageSeed[] = [];
  const queuedPages: number[] = [];

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const special = specialRoles.get(pageNumber);
    const inDigitize = pageNumber >= pageStart && pageNumber <= pageEnd;
    const pageRole: PageRole = special ?? "body";

    if (hasSpecials) {
      if (special) {
        pages.push({
          pageNumber,
          status: "pending",
          stage: "queued",
          pageRole,
        });
        queuedPages.push(pageNumber);
      } else {
        pages.push({
          pageNumber,
          status: "stored",
          stage: null,
          pageRole: "body",
        });
      }
      continue;
    }

    const queued = inDigitize;
    if (queued) {
      queuedPages.push(pageNumber);
    }
    pages.push({
      pageNumber,
      status: queued ? "pending" : "stored",
      stage: queued ? "queued" : null,
      pageRole,
    });
  }

  // Special pages outside the digitize window are still extracted in Phase 1.
  if (hasSpecials && queuedPages.length === 0) {
    return {
      ok: false,
      error: "Assign at least one special page, or clear page roles",
    };
  }

  return {
    ok: true,
    pageStart,
    pageEnd,
    pages,
    queuedPages,
    bodyConversionQueued: !hasSpecials,
  };
};

/** Stored digitize end, or the last page when the book has no end recorded. */
export const resolveDigitizeEnd = (
  digitizePageEnd: number | null,
  pageNumbers: readonly number[],
): number => digitizePageEnd ?? Math.max(...pageNumbers, 1);

/** How many pages a digitize-from/through pair would send to AI, or null when the inputs are incomplete or invalid. */
export const queuedPageCount = (
  totalPages: number,
  pageStartRaw: string,
  pageEndRaw: string,
  specialRoles?: ReadonlyMap<number, SpecialPageRole>,
): number | null => {
  const result = digitizePageSeeds(
    totalPages,
    pageStartRaw,
    pageEndRaw,
    specialRoles,
  );
  if (!result.ok) {
    return null;
  }
  return result.queuedPages.length;
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

/** Role assigned to a page, or body when none. */
export const roleForPreviewPage = (
  pageNumber: number,
  specialRoles: ReadonlyMap<number, SpecialPageRole>,
): PageRole => specialRoles.get(pageNumber) ?? "body";
