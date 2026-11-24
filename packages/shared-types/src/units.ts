import {
  headingLevel,
} from "./block-ast.js";
import type {
  HeadingLevel,
  PageBlock,
  PageExtractedJson,
  UnitContent,
} from "./block-ast.js";
import type { ContentsEntry } from "./contents.js";
import { resolveUnitLevel } from "./contents.js";
import type { PageRole, UnitKind } from "./page-roles.js";
import {
  referenceUnitTitle,
  unitKindForPageRole,
} from "./page-roles.js";

export interface UnitDraft extends UnitContent {
  orderIndex: number;
}

export interface BuildUnitsOptions {
  language?: "ky" | "ru";
  /** Role by PDF page number; missing pages are treated as body. */
  pageRoles?: ReadonlyMap<number, PageRole>;
  /** Reviewed TOC; levels win over title inference when titles match. */
  contentsOutline?: ContentsEntry[] | null;
}

const roleOf = (
  pageNumber: number,
  pageRoles: ReadonlyMap<number, PageRole> | undefined,
): PageRole => pageRoles?.get(pageNumber) ?? "body";

/**
 * Turn reviewed pages into units.
 *
 * A `unit_header` block opens a body unit and supplies its header; it never
 * enters the body. Special-role pages (cover, glossary, appendix, answers)
 * group into one reference unit per contiguous run. Table-of-contents pages
 * are skipped. Content before the first unit header is collected under
 * `fallbackTitle`.
 */
export const buildUnits = (
  pages: PageExtractedJson[],
  fallbackTitle: string,
  options: BuildUnitsOptions = {},
): UnitDraft[] => {
  const { language = "ky", pageRoles, contentsOutline = null } = options;
  const drafts: UnitDraft[] = [];
  const ordered = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  const open = (
    title: string,
    level: HeadingLevel,
    page: PageExtractedJson,
    kind: UnitKind = "body",
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
        ...(kind === "body" ? {} : { kind }),
      },
      body: [],
    };
    drafts.push(draft);
    return draft;
  };

  const openReference = (
    kind: Exclude<UnitKind, "body">,
    page: PageExtractedJson,
  ): UnitDraft => open(referenceUnitTitle(kind, language), 1, page, kind);

  let reference: UnitDraft | null = null;
  let referenceKind: Exclude<UnitKind, "body"> | null = null;

  for (const page of ordered) {
    const role = roleOf(page.pageNumber, pageRoles);
    const kind = unitKindForPageRole(role);

    // TOC pages feed contentsOutline elsewhere; they are not reading units.
    if (kind === null) {
      reference = null;
      referenceKind = null;
      continue;
    }

    if (kind !== "body") {
      if (!reference || referenceKind !== kind) {
        reference = openReference(kind, page);
        referenceKind = kind;
      } else {
        reference.header.pageEnd = page.pageNumber;
        reference.header.pageEndLabel = page.printedPage;
      }

      let anchored = false;
      const ensureAnchor = (): void => {
        if (!reference || anchored) {
          return;
        }
        anchored = true;
        const last = reference.body[reference.body.length - 1];
        reference.body.push({
          id: `page-${page.pageNumber}`,
          type: "page_anchor",
          pageNumber: page.pageNumber,
          label: page.printedPage,
          midParagraph:
            page.continuesFromPrevious && last?.type === "markdown",
        });
      };

      for (const block of page.blocks) {
        if (block.type === "unit_header") {
          // Special pages should not open body lessons; keep the title as text.
          ensureAnchor();
          reference.body.push({
            id: block.id,
            type: "markdown",
            markdown: `# ${block.title}`,
          });
          continue;
        }
        ensureAnchor();
        reference.body.push(block);
      }
      ensureAnchor();
      continue;
    }

    // Body pages: reset reference grouping and split on unit_header.
    reference = null;
    referenceKind = null;
    let anchored = false;

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
        const level = resolveUnitLevel(
          block.title,
          block.level,
          block.levelPinned,
          contentsOutline,
        );
        open(block.title, level, page, "body");
        anchored = false;
        continue;
      }
      unitFor(block).body.push(block);
    }

    unitFor(null);
  }

  return drafts.map((draft, orderIndex) => ({ ...draft, orderIndex }));
};

/** Body (lesson) units only — excludes front/back matter. */
export const bodyUnits = (units: UnitDraft[]): UnitDraft[] =>
  units.filter(
    (unit) => !unit.header.kind || unit.header.kind === "body",
  );

/** Front/back-matter reference units. */
export const matterUnits = (units: UnitDraft[]): UnitDraft[] =>
  units.filter(
    (unit) => unit.header.kind && unit.header.kind !== "body",
  );

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

/** Re-export for callers that already import heading helpers from units. */
export { headingLevel };
