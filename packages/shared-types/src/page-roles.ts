/** How a PDF page is extracted. Body is the default for lesson pages. */
export const PAGE_ROLES = [
  "body",
  "table_of_contents",
  "cover",
  "glossary",
  "appendix",
  "answers",
] as const;

export type PageRole = (typeof PAGE_ROLES)[number];

/** Special roles an admin can assign on upload (everything except body). */
export const SPECIAL_PAGE_ROLES = [
  "cover",
  "table_of_contents",
  "glossary",
  "appendix",
  "answers",
] as const;

export type SpecialPageRole = (typeof SPECIAL_PAGE_ROLES)[number];

/** Form field keys → special page role. */
export interface PageRoleAssignments {
  cover: number[];
  tableOfContents: number[];
  glossary: number[];
  appendices: number[];
  answers: number[];
}

/** Role for a front/back-matter unit header (not a lesson). */
export type UnitKind = "body" | "cover" | "glossary" | "appendix" | "answers";

/** Map a page role to a unit kind, or null for TOC pages (no unit). */
export const unitKindForPageRole = (role: PageRole): UnitKind | null => {
  switch (role) {
    case "cover":
      return "cover";
    case "glossary":
      return "glossary";
    case "appendix":
      return "appendix";
    case "answers":
      return "answers";
    case "table_of_contents":
      return null;
    default:
      return "body";
  }
};

/** Localized label for a reference unit in the sidebar. */
export const referenceUnitTitle = (
  kind: Exclude<UnitKind, "body">,
  language: "ky" | "ru",
): string => {
  const titles: Record<Exclude<UnitKind, "body">, { ky: string; ru: string }> = {
    cover: { ky: "Мукаба", ru: "Обложка" },
    glossary: { ky: "Глоссарий", ru: "Глоссарий" },
    appendix: { ky: "Тиркеме", ru: "Приложение" },
    answers: { ky: "Жооптор", ru: "Ответы" },
  };
  return titles[kind][language];
};

/** Display name for a page role badge. */
export const pageRoleLabel = (role: PageRole): string => {
  switch (role) {
    case "table_of_contents":
      return "Table of contents";
    case "cover":
      return "Cover";
    case "glossary":
      return "Glossary";
    case "appendix":
      return "Appendix";
    case "answers":
      return "Answers";
    default:
      return "Body";
  }
};

/**
 * Parse a flexible page-number input: `1, 2`, `[222, 223]`, `218-221`.
 * Blank means no pages. Duplicates are dropped; order is ascending.
 */
export const parsePageNumbersInput = (
  raw: string,
):
  | { ok: true; pages: number[] }
  | { ok: false; error: string } => {
  const text = raw.trim();
  if (!text) {
    return { ok: true, pages: [] };
  }

  const cleaned = text.replace(/^\[|\]$/g, "").trim();
  if (!cleaned) {
    return { ok: true, pages: [] };
  }

  const pages = new Set<number>();
  for (const part of cleaned.split(/[,;\s]+/).filter(Boolean)) {
    const range = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(part);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < 1 ||
        start > end
      ) {
        return {
          ok: false,
          error: `Invalid page range “${part}”`,
        };
      }
      for (let page = start; page <= end; page += 1) {
        pages.add(page);
      }
      continue;
    }
    const page = Number(part);
    if (!Number.isInteger(page) || page < 1) {
      return { ok: false, error: `Invalid page number “${part}”` };
    }
    pages.add(page);
  }

  return { ok: true, pages: [...pages].sort((a, b) => a - b) };
};

/** Whether every page sits inside a PDF of this many pages. */
export const pageNumbersInPdf = (
  pages: number[],
  totalPages: number,
): boolean =>
  pages.every((page) => page >= 1 && page <= totalPages);

/**
 * Build a role map from form assignments. Fails when the same page is
 * assigned to two special roles, or a page is outside the PDF.
 */
export const resolvePageRoles = (
  assignments: PageRoleAssignments,
  totalPages: number,
):
  | { ok: true; byPage: Map<number, SpecialPageRole>; specialPages: number[] }
  | { ok: false; error: string } => {
  const byPage = new Map<number, SpecialPageRole>();
  const fields: Array<{ role: SpecialPageRole; pages: number[] }> = [
    { role: "cover", pages: assignments.cover },
    { role: "table_of_contents", pages: assignments.tableOfContents },
    { role: "glossary", pages: assignments.glossary },
    { role: "appendix", pages: assignments.appendices },
    { role: "answers", pages: assignments.answers },
  ];

  for (const field of fields) {
    if (!pageNumbersInPdf(field.pages, totalPages)) {
      return {
        ok: false,
        error: `A ${pageRoleLabel(field.role).toLowerCase()} page is outside this ${totalPages}-page PDF`,
      };
    }
    for (const page of field.pages) {
      const existing = byPage.get(page);
      if (existing) {
        return {
          ok: false,
          error: `PDF page ${page} is assigned to both ${pageRoleLabel(existing).toLowerCase()} and ${pageRoleLabel(field.role).toLowerCase()}`,
        };
      }
      byPage.set(page, field.role);
    }
  }

  return {
    ok: true,
    byPage,
    specialPages: [...byPage.keys()].sort((a, b) => a - b),
  };
};

/** Parse all special-role form fields at once. */
export const parsePageRoleAssignments = (fields: {
  cover: string;
  tableOfContents: string;
  glossary: string;
  appendices: string;
  answers: string;
}):
  | { ok: true; assignments: PageRoleAssignments }
  | { ok: false; error: string } => {
  const cover = parsePageNumbersInput(fields.cover);
  if (!cover.ok) {
    return { ok: false, error: `Cover: ${cover.error}` };
  }
  const tableOfContents = parsePageNumbersInput(fields.tableOfContents);
  if (!tableOfContents.ok) {
    return { ok: false, error: `Table of contents: ${tableOfContents.error}` };
  }
  const glossary = parsePageNumbersInput(fields.glossary);
  if (!glossary.ok) {
    return { ok: false, error: `Glossary: ${glossary.error}` };
  }
  const appendices = parsePageNumbersInput(fields.appendices);
  if (!appendices.ok) {
    return { ok: false, error: `Appendices: ${appendices.error}` };
  }
  const answers = parsePageNumbersInput(fields.answers);
  if (!answers.ok) {
    return { ok: false, error: `Answers: ${answers.error}` };
  }
  return {
    ok: true,
    assignments: {
      cover: cover.pages,
      tableOfContents: tableOfContents.pages,
      glossary: glossary.pages,
      appendices: appendices.pages,
      answers: answers.pages,
    },
  };
};

/** Role of a PDF page from an assignment map; body when unlisted. */
export const roleForPage = (
  pageNumber: number,
  byPage: Map<number, SpecialPageRole>,
): PageRole => byPage.get(pageNumber) ?? "body";
