import { z } from "zod";

/*
 * Book content is continuous Markdown interrupted only by components.
 * Headings, lists, and simple tables stay inside the Markdown. A table block
 * is a grid GFM cannot draw: a cell spans columns or rows, or a header is
 * stacked on a second line. Ingestion emits markdown, image, unit_header,
 * and table.
 */

export const BBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export type BBox = z.infer<typeof BBoxSchema>;

export const TableCellSchema = z.object({
  text: z.string(),
  colspan: z.number().int().min(1).optional(),
  rowspan: z.number().int().min(1).optional(),
});

export const TableRowSchema = z.object({
  header: z.boolean(),
  cells: z.array(TableCellSchema),
});

/** A grid with merged or stacked header cells. Simple tables stay in Markdown. */
export const TableBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("table"),
  caption: z.string().nullable(),
  rows: z.array(TableRowSchema),
});

export const MarkdownBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("markdown"),
  markdown: z.string(),
});

export const ImageBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("image"),
  url: z.string(),
  alt: z.string(),
  ai_description: z.string(),
  caption: z.string().nullish(),
  bbox: BBoxSchema.nullish(),
});

/** 1 is a chapter, 2 a lesson, 3–6 a subsection. */
export const HeadingLevelSchema = z.number().int().min(1).max(6);

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const TITLE_NUMBER =
  /^((?:§\s*\d+\.?|(?:[IVXLCІХ]+|\d+)\.)(?:\s*\d+\.)*)\s*(.*)$/i;

/**
 * The rank of a title the book numbers itself. "II." is 1, "II. 1." and
 * "§ 3." are 2, "II. 1. 2." is 3. An unnumbered title is a lesson.
 */
export const inferHeadingLevel = (title: string): HeadingLevel => {
  const match = title.trim().match(TITLE_NUMBER);
  const number = match?.[1] ?? "";
  if (!number) {
    return 2;
  }
  if (number.trim().startsWith("§")) {
    return 2;
  }
  const parts = number.split(".").map((part) => part.trim()).filter(Boolean);
  const level = parts.length;
  if (level < 1) {
    return 2;
  }
  return Math.min(6, level) as HeadingLevel;
};

/** An explicit level wins; otherwise the title's own numbering decides. */
export const headingLevel = (
  title: string,
  level?: number | null,
): HeadingLevel =>
  typeof level === "number" && level >= 1 && level <= 6
    ? (level as HeadingLevel)
    : inferHeadingLevel(title);

/** A new unit starts here. The title becomes the unit header, not body content. */
export const UnitHeaderBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("unit_header"),
  title: z.string(),
  /** Absent on pages saved before levels existed; readers infer it from the title. */
  level: HeadingLevelSchema.optional(),
  /**
   * True when a reviewer set the level by hand; contents refresh leaves it alone.
   */
  levelPinned: z.boolean().optional(),
});

/** Metadata extracted from a cover page. */
export const CoverMetaSchema = z.object({
  title: z.string().optional(),
  authors: z.array(z.string()).optional(),
  publishedYear: z.number().int().optional(),
  publisher: z.string().optional(),
});

export type CoverMeta = z.infer<typeof CoverMetaSchema>;

/** One line of a structured table of contents from a TOC page extraction. */
export const TocEntrySchema = z.object({
  title: z.string().trim().min(1),
  level: HeadingLevelSchema,
  printedPage: z.string().trim().min(1),
});

export type TocEntry = z.infer<typeof TocEntrySchema>;

/**
 * Where a textbook page starts inside a unit body. `label` is the number
 * printed on the page; `pageNumber` is its position in the source PDF.
 * `midParagraph` means the text on both sides is one paragraph.
 */
export const PageAnchorBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("page_anchor"),
  pageNumber: z.number().int().min(1),
  label: z.string().nullable(),
  midParagraph: z.boolean(),
});

/** What a reviewed page holds. */
export const PageBlockSchema = z.discriminatedUnion("type", [
  MarkdownBlockSchema,
  ImageBlockSchema,
  UnitHeaderBlockSchema,
  TableBlockSchema,
]);

/** What a published unit body holds. */
export const UnitBlockSchema = z.discriminatedUnion("type", [
  MarkdownBlockSchema,
  ImageBlockSchema,
  PageAnchorBlockSchema,
  TableBlockSchema,
]);

export type TableCell = z.infer<typeof TableCellSchema>;
export type TableRow = z.infer<typeof TableRowSchema>;
export type TableBlock = z.infer<typeof TableBlockSchema>;
export type MarkdownBlock = z.infer<typeof MarkdownBlockSchema>;
export type ImageBlock = z.infer<typeof ImageBlockSchema>;
export type UnitHeaderBlock = z.infer<typeof UnitHeaderBlockSchema>;
export type PageAnchorBlock = z.infer<typeof PageAnchorBlockSchema>;
export type PageBlock = z.infer<typeof PageBlockSchema>;
export type UnitBlock = z.infer<typeof UnitBlockSchema>;

export const PageExtractedJsonSchema = z.object({
  /** Position in the source PDF, 1-based. */
  pageNumber: z.number().int().min(1),
  /** The number printed on the page, as printed; null when there is none. */
  printedPage: z.string().nullable(),
  /** True when the page opens in the middle of a paragraph begun on the previous page. */
  continuesFromPrevious: z.boolean(),
  blocks: z.array(PageBlockSchema),
  warnings: z.array(z.string()),
  model: z.string(),
  extractedAt: z.string(),
  /** Structured TOC lines when this page was extracted as table_of_contents. */
  tocEntries: z.array(TocEntrySchema).optional(),
  /** Cover metadata when this page was extracted as cover. */
  coverMeta: CoverMetaSchema.optional(),
});

export type PageExtractedJson = z.infer<typeof PageExtractedJsonSchema>;

/** The header of a unit is kept apart from its body. */
export const UnitHeaderSchema = z.object({
  title: z.string(),
  level: HeadingLevelSchema,
  pageStart: z.number().int().min(1),
  pageEnd: z.number().int().min(1),
  pageStartLabel: z.string().nullable(),
  pageEndLabel: z.string().nullable(),
  /** Absent or "body" for lesson units; otherwise a front/back-matter kind. */
  kind: z
    .enum(["body", "cover", "glossary", "appendix", "answers"])
    .optional(),
});

export type UnitHeader = z.infer<typeof UnitHeaderSchema>;

export const UnitContentSchema = z.object({
  header: UnitHeaderSchema,
  body: z.array(UnitBlockSchema),
});

export type UnitContent = z.infer<typeof UnitContentSchema>;

export const KYRGYZ_SPECIAL_LETTERS = /[ӨөҮүҢң]/;

export const hasKyrgyzLetters = (text: string): boolean =>
  KYRGYZ_SPECIAL_LETTERS.test(text);

export const collectBlockText = (blocks: PageBlock[]): string =>
  blocks
    .map((block) => {
      switch (block.type) {
        case "markdown":
          return block.markdown;
        case "unit_header":
          return block.title;
        case "image":
          return `${block.alt} ${block.ai_description} ${block.caption ?? ""}`;
        case "table":
          return [
            block.caption ?? "",
            ...block.rows.flatMap((row) => row.cells.map((cell) => cell.text)),
          ].join(" ");
        default:
          return "";
      }
    })
    .join("\n");

export const warnMissingKyrgyzLetters = (
  language: "ky" | "ru",
  blocks: PageBlock[],
  minChars = 80,
): string | null => {
  if (language !== "ky") {
    return null;
  }
  const text = collectBlockText(blocks);
  if (text.replace(/\s+/g, "").length < minChars) {
    return null;
  }
  if (hasKyrgyzLetters(text)) {
    return null;
  }
  return "ky_page_missing_kyrgyz_letters: long transcription has no Ө/Ү/Ң characters";
};

/** Neighbouring Markdown blocks are one block; an image or a unit header is the only thing that separates text. */
export const mergeAdjacentMarkdown = (blocks: PageBlock[]): PageBlock[] => {
  const merged: PageBlock[] = [];
  for (const block of blocks) {
    const previous = merged[merged.length - 1];
    if (block.type === "markdown" && previous?.type === "markdown") {
      merged[merged.length - 1] = {
        ...previous,
        markdown: [previous.markdown.trimEnd(), block.markdown.trimStart()]
          .filter(Boolean)
          .join("\n\n"),
      };
      continue;
    }
    merged.push(block);
  }
  return merged;
};
