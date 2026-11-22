import { bookPages } from "@oku/db";
import {
  PageExtractedJsonSchema,
  warnMissingKyrgyzLetters,
  type PageExtractedJson,
} from "@oku/shared-types";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { books } from "@oku/db";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface RouteContext {
  params: Promise<{ bookId: string; pageNumber: string }>;
}

export const GET = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  const { bookId, pageNumber: pageNumberRaw } = await context.params;
  const pageNumber = Number(pageNumberRaw);
  const db = getDb();

  const [page] = await db
    .select()
    .from(bookPages)
    .where(
      and(eq(bookPages.bookId, bookId), eq(bookPages.pageNumber, pageNumber)),
    )
    .limit(1);

  if (!page) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ page });
};

export const PUT = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  const { bookId, pageNumber: pageNumberRaw } = await context.params;
  const pageNumber = Number(pageNumberRaw);
  const body = (await request.json()) as {
    extractedJson?: unknown;
    markReviewed?: boolean;
  };

  if (!body.extractedJson) {
    return NextResponse.json({ error: "extractedJson required" }, { status: 400 });
  }

  let parsed: PageExtractedJson;
  try {
    parsed = PageExtractedJsonSchema.parse(body.extractedJson);
  } catch {
    return NextResponse.json({ error: "invalid extractedJson" }, { status: 400 });
  }

  const db = getDb();
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  if (!book) {
    return NextResponse.json({ error: "book not found" }, { status: 404 });
  }

  const warnings = [...parsed.warnings];
  const kyrgyzWarning = warnMissingKyrgyzLetters(book.language, parsed.blocks);
  if (kyrgyzWarning && !warnings.includes(kyrgyzWarning)) {
    warnings.push(kyrgyzWarning);
  }

  const nextJson: PageExtractedJson = {
    ...parsed,
    pageNumber,
    warnings,
  };

  const [updated] = await db
    .update(bookPages)
    .set({
      extractedJson: nextJson,
      status: body.markReviewed ? "reviewed" : "extracted",
      errorMessage: null,
      stage: body.markReviewed ? "reviewed" : "edited",
      updatedAt: new Date(),
    })
    .where(
      and(eq(bookPages.bookId, bookId), eq(bookPages.pageNumber, pageNumber)),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (book.status === "draft") {
    await db
      .update(books)
      .set({ status: "review", updatedAt: new Date() })
      .where(eq(books.id, bookId));
  }

  return NextResponse.json({ page: updated });
};
