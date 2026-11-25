import { bookPages, ingestionJobs } from "@oku/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface RouteContext {
  params: Promise<{ bookId: string; pageNumber: string }>;
}

export const POST = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  const denied = await requireAdmin(request);
  if (denied) {
    return denied;
  }

  const { bookId, pageNumber: pageNumberRaw } = await context.params;
  const pageNumber = Number(pageNumberRaw);
  const body = (await request.json().catch(() => ({}))) as {
    force?: boolean;
  };
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

  if (page.status === "reviewed" && !body.force) {
    return NextResponse.json(
      { error: "reviewed pages are protected; pass force=true to overwrite" },
      { status: 409 },
    );
  }

  const [updated] = await db
    .update(bookPages)
    .set({
      status: "pending",
      errorMessage: null,
      stage: "queued",
      updatedAt: new Date(),
    })
    .where(eq(bookPages.id, page.id))
    .returning();

  await db.insert(ingestionJobs).values({
    bookId,
    status: "queued",
    pageStart: pageNumber,
    pageEnd: pageNumber,
    totalPages: 1,
    completedPages: 0,
    failedPages: 0,
  });

  return NextResponse.json({ page: updated });
};
