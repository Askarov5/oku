import { bookPages } from "@oku/db";
import { asc, eq } from "drizzle-orm";
import { buildOutline, unitRangeLabel } from "./book-outline";
import { listLibraryBooks } from "./catalog-db";
import { getDb } from "./db";
import type { StudioBookOption, StudioFigure, StudioUnitOption } from "./lesson-studio";
import { SAMPLE_STUDIO_BOOKS } from "./lesson-studio";

const MARKDOWN_CAP = 12_000;

const summarizeMarkdown = (raw: string): string => {
  const plain = raw
    .replace(/[#>*`|_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 220 ? `${plain.slice(0, 217)}…` : plain;
};

export const loadStudioCatalog = async (): Promise<StudioBookOption[]> => {
  const db = getDb();
  const libraryBooks = await listLibraryBooks();
  const result: StudioBookOption[] = [];

  for (const book of libraryBooks) {
    const pages = await db
      .select({
        pageNumber: bookPages.pageNumber,
        extractedJson: bookPages.extractedJson,
        pageRole: bookPages.pageRole,
      })
      .from(bookPages)
      .where(eq(bookPages.bookId, book.id))
      .orderBy(asc(bookPages.pageNumber));

    const outline = buildOutline(pages, book.title, {
      language: book.language,
      contentsOutline: book.contentsOutline,
    });

    if (outline.body.length === 0) continue;

    const units: StudioUnitOption[] = outline.body.map((unit, idx) => {
      const markdownChunks: string[] = [];
      const figures: StudioFigure[] = [];

      for (const block of unit.body) {
        if (block.type === "markdown") {
          markdownChunks.push(block.markdown);
        } else if (block.type === "image") {
          figures.push({
            id: block.id,
            url: block.url,
            caption: block.caption ?? (block.alt || "Textbook figure"),
            description: block.ai_description,
            pageLabel: unitRangeLabel(outline, unit.header),
          });
        }
      }

      const fullText = markdownChunks.join("\n\n");
      return {
        id: `${book.id}-u-${idx + 1}`,
        orderIndex: unit.orderIndex,
        title: unit.header.title,
        pageRangeLabel: unitRangeLabel(outline, unit.header),
        summary:
          summarizeMarkdown(fullText) ||
          `${unit.header.title} (${unitRangeLabel(outline, unit.header)})`,
        keyTerms: [unit.header.title],
        figures,
        // Extended field used only when creating a lesson.
        markdownExcerpt: fullText.slice(0, MARKDOWN_CAP),
      } as StudioUnitOption & { markdownExcerpt: string };
    });

    result.push({
      id: book.id,
      title: book.title,
      language: book.language,
      categoryName: book.categoryName,
      subcategoryName: book.subcategoryName,
      isSchoolTextbook: book.isSchoolTextbook,
      grade: book.grade,
      publishedYear: book.publishedYear,
      source: "library",
      units,
    });
  }

  return [...result, ...SAMPLE_STUDIO_BOOKS];
};

export const resolveUnitForLesson = async (input: {
  bookId: string;
  unitId?: string;
  unitIndex: number;
}): Promise<{
  book: StudioBookOption;
  unit: StudioUnitOption & { markdownExcerpt?: string };
} | null> => {
  const catalog = await loadStudioCatalog();
  const book = catalog.find((item) => item.id === input.bookId);
  if (!book) return null;
  const unit =
    (input.unitId
      ? book.units.find((item) => item.id === input.unitId)
      : undefined) ?? book.units[input.unitIndex];
  if (!unit) return null;
  return { book, unit };
};
