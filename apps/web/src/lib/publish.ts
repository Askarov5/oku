import { PageExtractedJsonSchema, buildUnits } from "@oku/shared-types";
import { bookPages, books, units } from "@oku/db";
import { asc, eq } from "drizzle-orm";
import { getDb } from "./db";

/**
 * Digitized pages that must be reviewed before publish. Saved-only originals
 * stay on the book and are skipped until they are digitized.
 */
export const publishPipeline = <T extends { status: string }>(
  pages: T[],
): T[] => pages.filter((page) => page.status !== "stored");

/** Why a book cannot be published yet, or null when every digitized page is reviewed. */
export const publishBlocker = (
  pages: Array<{ status: string }>,
): string | null => {
  if (pages.length === 0) {
    return "book has no pages";
  }
  const pipeline = publishPipeline(pages);
  if (pipeline.length === 0) {
    return "digitize at least one page before publish";
  }
  const unfinished = pipeline.filter((page) => page.status !== "reviewed");
  if (unfinished.length > 0) {
    return `all digitized pages must be reviewed before publish (${unfinished.length} remaining)`;
  }
  return null;
};

export const publishBook = async (bookId: string): Promise<{ unitCount: number }> => {
  const db = getDb();
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  if (!book) {
    throw new Error("book not found");
  }

  const pages = await db
    .select()
    .from(bookPages)
    .where(eq(bookPages.bookId, bookId))
    .orderBy(asc(bookPages.pageNumber));

  const blocked = publishBlocker(pages);
  if (blocked) {
    throw new Error(blocked);
  }

  const pipeline = publishPipeline(pages);

  // Content before the first unit header is published under the book title.
  const drafts = buildUnits(
    pipeline.map((page) => PageExtractedJsonSchema.parse(page.extractedJson)),
    book.title,
  );

  await db.delete(units).where(eq(units.bookId, bookId));
  await db.insert(units).values(
    drafts.map((draft) => ({
      bookId,
      orderIndex: draft.orderIndex,
      quarter: null,
      header: draft.header,
      body: draft.body,
    })),
  );

  await db
    .update(books)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(books.id, bookId));

  return { unitCount: drafts.length };
};
