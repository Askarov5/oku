import { bookPages, ingestionJobs } from "@oku/db";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export const POST = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  const { jobId } = await context.params;
  const db = getDb();

  const [job] = await db
    .select()
    .from(ingestionJobs)
    .where(eq(ingestionJobs.id, jobId))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await db
    .update(bookPages)
    .set({
      status: "pending",
      errorMessage: null,
      stage: "queued",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookPages.bookId, job.bookId),
        gte(bookPages.pageNumber, job.pageStart),
        lte(bookPages.pageNumber, job.pageEnd),
        inArray(bookPages.status, ["failed", "extracted"]),
      ),
    );

  const [created] = await db
    .insert(ingestionJobs)
    .values({
      bookId: job.bookId,
      status: "queued",
      pageStart: job.pageStart,
      pageEnd: job.pageEnd,
      totalPages: job.totalPages,
      completedPages: 0,
      failedPages: 0,
    })
    .returning();

  return NextResponse.json({ job: created });
};
