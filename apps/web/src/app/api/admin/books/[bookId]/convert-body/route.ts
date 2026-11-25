import { bookPages, books, ingestionJobs } from "@oku/db";
import {
  ContentsOutlineSchema,
  readStoredContents,
  type ContentsEntry,
  type HeadingLevel,
} from "@oku/shared-types";
import { and, eq, inArray, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { resolveDigitizeEnd } from "@/lib/book-page-range";
import { getDb } from "@/lib/db";

interface RouteContext {
  params: Promise<{ bookId: string }>;
}

/**
 * Phase 2: save an approved TOC (optional), mark body pages in the digitize
 * range as pending, and queue an ingestion job for them.
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
    contentsOutline?: unknown;
    markSpecialsReviewed?: boolean;
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

  if (book.bodyConversionQueued) {
    return NextResponse.json(
      { error: "Body conversion is already queued for this book" },
      { status: 409 },
    );
  }

  let outline: ContentsEntry[] | null = null;
  if (body.contentsOutline !== undefined) {
    if (body.contentsOutline === null) {
      outline = null;
    } else {
      const parsed = ContentsOutlineSchema.safeParse(body.contentsOutline);
      if (!parsed.success || parsed.data.length === 0) {
        return NextResponse.json(
          { error: "Each contents row needs a title, a level, and a page" },
          { status: 400 },
        );
      }
      outline = parsed.data.map((entry) => ({
        title: entry.title,
        level: entry.level as HeadingLevel,
        printedPage: entry.printedPage,
      }));
    }
  } else {
    outline = readStoredContents(book.contentsOutline);
  }

  const pageStart = book.digitizePageStart ?? 1;
  const pages = await db
    .select()
    .from(bookPages)
    .where(eq(bookPages.bookId, bookId));
  const pageEnd = resolveDigitizeEnd(
    book.digitizePageEnd,
    pages.map((page) => page.pageNumber),
  );

  const bodyPages = pages
    .filter(
      (page) =>
        page.pageRole === "body" &&
        page.pageNumber >= pageStart &&
        page.pageNumber <= pageEnd &&
        (page.status === "stored" || page.status === "failed"),
    )
    .map((page) => page.pageNumber)
    .sort((a, b) => a - b);

  if (bodyPages.length === 0) {
    return NextResponse.json(
      { error: "No body pages left to convert in the digitize range" },
      { status: 400 },
    );
  }

  const now = new Date();
  await db
    .update(books)
    .set({
      contentsOutline: outline,
      bodyConversionQueued: true,
      updatedAt: now,
    })
    .where(eq(books.id, bookId));

  if (body.markSpecialsReviewed) {
    await db
      .update(bookPages)
      .set({ status: "reviewed", updatedAt: now })
      .where(
        and(
          eq(bookPages.bookId, bookId),
          ne(bookPages.pageRole, "body"),
          eq(bookPages.status, "extracted"),
        ),
      );
  }

  await db
    .update(bookPages)
    .set({
      status: "pending",
      stage: "queued",
      errorMessage: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(bookPages.bookId, bookId),
        eq(bookPages.pageRole, "body"),
        inArray(bookPages.pageNumber, bodyPages),
      ),
    );

  const [job] = await db
    .insert(ingestionJobs)
    .values({
      bookId,
      status: "queued",
      pageStart: bodyPages[0]!,
      pageEnd: bodyPages[bodyPages.length - 1]!,
      pageNumbers: bodyPages,
      totalPages: bodyPages.length,
      completedPages: 0,
      failedPages: 0,
    })
    .returning();

  return NextResponse.json({
    jobId: job?.id,
    bodyPageCount: bodyPages.length,
    pageStart: bodyPages[0],
    pageEnd: bodyPages[bodyPages.length - 1],
    contentsOutline: outline,
  });
};
