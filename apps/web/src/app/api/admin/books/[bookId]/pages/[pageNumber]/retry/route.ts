import { bookPages, ingestionJobs } from "@oku/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { isRunnableModel } from "@/lib/extraction-model";
import type { ProviderKeys } from "@/lib/extraction-model";
import { RETRY_INSTRUCTION_MAX } from "@/lib/retry-instruction";

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
    instruction?: string;
    model?: string;
  };
  const db = getDb();
  const env = getEnv();
  const keys: ProviderKeys = {
    gemini: env.geminiApiKey,
    openai: env.openaiApiKey,
    anthropic: env.anthropicApiKey,
  };

  if (typeof body.model !== "string" || !isRunnableModel(body.model, keys)) {
    return NextResponse.json(
      {
        error:
          "Choose a model, for example gemini/gemini-3.6-flash. Other providers appear after their API key is set.",
      },
      { status: 400 },
    );
  }
  const model = body.model;

  let instruction: string | null = null;
  if (typeof body.instruction === "string") {
    const trimmed = body.instruction.trim();
    if (trimmed.length > RETRY_INSTRUCTION_MAX) {
      return NextResponse.json(
        {
          error: `instruction must be ${RETRY_INSTRUCTION_MAX} characters or fewer`,
        },
        { status: 400 },
      );
    }
    instruction = trimmed || null;
  }

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
    instruction,
    model,
  });

  return NextResponse.json({ page: updated });
};
