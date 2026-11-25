import { bookPages, books } from "@oku/db";
import {
  PageExtractedJsonSchema,
  collectTocEntries,
  parseContentsOutlineFromPages,
  readStoredContents,
} from "@oku/shared-types";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { applyOutlineToPages } from "@/lib/apply-outline";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface RouteContext {
  params: Promise<{ bookId: string }>;
}

/**
 * Re-read digitized TOC pages (by pageRole or explicit page list), save that
 * outline, and write those levels onto matching unit headers.
 */
export const POST = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  const denied = await requireAdmin(request);
  if (denied) {
    return denied;
  }

  const { bookId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    pageNumbers?: number[];
  };

  const db = getDb();
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);
  if (!book) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const pages = await db
    .select()
    .from(bookPages)
    .where(eq(bookPages.bookId, bookId));

  const tocPageNumbers =
    Array.isArray(body.pageNumbers) && body.pageNumbers.length > 0
      ? body.pageNumbers.filter((n) => Number.isInteger(n) && n >= 1)
      : pages
          .filter((page) => page.pageRole === "table_of_contents")
          .map((page) => page.pageNumber)
          .sort((a, b) => a - b);

  if (tocPageNumbers.length === 0) {
    return NextResponse.json(
      { error: "No table-of-contents pages on this book" },
      { status: 400 },
    );
  }

  const parsedPages = pages.map((page) => {
    const extracted = PageExtractedJsonSchema.safeParse(page.extractedJson);
    return {
      pageNumber: page.pageNumber,
      extractedJson: extracted.success ? extracted.data : null,
      row: page,
    };
  });

  const outline = parseContentsOutlineFromPages(tocPageNumbers, parsedPages);
  if (!outline.ok) {
    const message =
      outline.reason === "no_lines"
        ? `TOC pages are digitized, but have no contents lines. Check that these are table of contents pages.`
        : outline.reason === "empty"
          ? "Table of contents pages are not digitized yet"
          : "Table of contents pages are not digitized yet";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Prefer an already-saved manual outline for applying levels when present;
  // refresh still overwrites contentsOutline from the pages.
  const entries = outline.entries;
  const withContent = parsedPages.filter(
    (page): page is typeof page & { extractedJson: NonNullable<typeof page.extractedJson> } =>
      page.extractedJson !== null,
  );
  const updatedHeaders = await applyOutlineToPages(
    withContent.map((page) => ({ id: page.row.id, json: page.extractedJson })),
    entries,
  );

  await db
    .update(books)
    .set({
      contentsOutline: entries,
      updatedAt: new Date(),
    })
    .where(eq(books.id, bookId));

  return NextResponse.json({
    entries,
    updatedHeaders,
    pageNumbers: tocPageNumbers,
    collected: collectTocEntries(
      tocPageNumbers.map((pageNumber) => {
        const page = parsedPages.find((item) => item.pageNumber === pageNumber);
        return {
          pageNumber,
          extractedJson: page?.extractedJson ?? null,
        };
      }),
    ),
    previous: readStoredContents(book.contentsOutline),
  });
};
