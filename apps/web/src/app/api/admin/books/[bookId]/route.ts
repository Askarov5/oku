import { bookPages, books, ingestionJobs, units } from "@oku/db";
import { asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface RouteContext {
  params: Promise<{ bookId: string }>;
}

export const GET = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  const { bookId } = await context.params;
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
    .where(eq(bookPages.bookId, bookId))
    .orderBy(asc(bookPages.pageNumber));

  const jobs = await db
    .select()
    .from(ingestionJobs)
    .where(eq(ingestionJobs.bookId, bookId))
    .orderBy(desc(ingestionJobs.createdAt));

  const bookUnits = await db
    .select()
    .from(units)
    .where(eq(units.bookId, bookId))
    .orderBy(asc(units.orderIndex));

  return NextResponse.json({ book, pages, jobs, units: bookUnits });
};
