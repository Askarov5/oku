import { PageExtractedJsonSchema, buildUnits } from "@oku/shared-types";
import { bookPages, books, units } from "@oku/db";
import { asc, eq } from "drizzle-orm";
import { getDb } from "./db";

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

  if (pages.length === 0) {
    throw new Error("book has no pages");
  }

  const unfinished = pages.filter((page) => page.status !== "reviewed");
  if (unfinished.length > 0) {
    throw new Error(
      `all pages must be reviewed before publish (${unfinished.length} remaining)`,
    );
  }

  // Content before the first unit header is published under the book title.
  const drafts = buildUnits(
    pages.map((page) => PageExtractedJsonSchema.parse(page.extractedJson)),
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
