import { z } from "zod";

/*
 * Book content is continuous Markdown interrupted only by components.
 * Headings, lists and tables stay inside the Markdown; they are not blocks.
 * Ingestion emits `markdown` and `image` only. Other components are authored
 * later and are never produced by automatic digitisation.
 */

export const BBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export type BBox = z.infer<typeof BBoxSchema>;

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

/** Page-level marker: a new unit starts here. Its title becomes the unit header, not body content. */
export const UnitHeaderBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("unit_header"),
  title: z.string(),
});

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
]);

/** What a published unit body holds. */
export const UnitBlockSchema = z.discriminatedUnion("type", [
  MarkdownBlockSchema,
  ImageBlockSchema,
  PageAnchorBlockSchema,
]);

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
});

export type PageExtractedJson = z.infer<typeof PageExtractedJsonSchema>;

/** The header of a unit is kept apart from its body. */
export const UnitHeaderSchema = z.object({
  title: z.string(),
  pageStart: z.number().int().min(1),
  pageEnd: z.number().int().min(1),
  pageStartLabel: z.string().nullable(),
  pageEndLabel: z.string().nullable(),
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
