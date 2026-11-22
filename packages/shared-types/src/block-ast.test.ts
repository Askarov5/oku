import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PageExtractedJsonSchema,
  mergeAdjacentMarkdown,
  warnMissingKyrgyzLetters,
} from "./block-ast.js";

const root = dirname(fileURLToPath(import.meta.url));

describe("PageExtractedJsonSchema", () => {
  it("accepts the shared fixture page", () => {
    const fixture = JSON.parse(
      readFileSync(join(root, "../fixtures/sample-page.json"), "utf8"),
    );
    const parsed = PageExtractedJsonSchema.parse(fixture);
    expect(parsed.printedPage).toBe("5");
    expect(parsed.blocks.map((block) => block.type)).toEqual([
      "unit_header",
      "markdown",
      "image",
      "markdown",
    ]);
  });

  it("rejects the old one-block-per-paragraph shape", () => {
    const legacy = {
      pageNumber: 1,
      blocks: [{ id: "p1", type: "paragraph", markdown: "Text" }],
      warnings: [],
      model: "test",
      extractedAt: "2026-11-21T00:00:00.000Z",
    };
    expect(PageExtractedJsonSchema.safeParse(legacy).success).toBe(false);
  });

  it("warns when a long ky page lacks Kyrgyz letters", () => {
    const warning = warnMissingKyrgyzLetters("ky", [
      {
        id: "m1",
        type: "markdown",
        markdown:
          "Это длинный русский текст без кыргызских букв который должен вызвать предупреждение эвристики.",
      },
    ]);
    expect(warning).toContain("ky_page_missing_kyrgyz_letters");
  });
});

describe("mergeAdjacentMarkdown", () => {
  it("joins neighbouring text and keeps components as separators", () => {
    const merged = mergeAdjacentMarkdown([
      { id: "a", type: "markdown", markdown: "# Heading" },
      { id: "b", type: "markdown", markdown: "First paragraph." },
      { id: "i", type: "image", url: "", alt: "", ai_description: "" },
      { id: "c", type: "markdown", markdown: "After the image." },
    ]);
    expect(merged).toEqual([
      { id: "a", type: "markdown", markdown: "# Heading\n\nFirst paragraph." },
      { id: "i", type: "image", url: "", alt: "", ai_description: "" },
      { id: "c", type: "markdown", markdown: "After the image." },
    ]);
  });
});
