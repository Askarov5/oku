import { lessons } from "@oku/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  bundleToWorkspace,
  enqueueLessonJob,
  hasActiveJob,
  loadLessonBundle,
  teacherCanMutate,
} from "@/lib/lesson-service";
import { requireUser } from "@/lib/user-session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const bundle = await loadLessonBundle(id);
  if (!bundle || !teacherCanMutate(bundle.lesson, auth.user.id)) {
    return NextResponse.json(
      { error: bundle?.lesson.isSample ? "Sample lesson is read-only" : "Lesson not found" },
      { status: bundle ? 403 : 404 },
    );
  }

  if ((bundle.lesson.planBlocks?.length ?? 0) === 0) {
    return NextResponse.json({ error: "Approve a plan first" }, { status: 400 });
  }

  if (await hasActiveJob(id)) {
    return NextResponse.json(
      { error: "Wait for the current generation job to finish" },
      { status: 409 },
    );
  }

  const db = getDb();
  await db
    .update(lessons)
    .set({ stage: "generating_materials", updatedAt: new Date() })
    .where(eq(lessons.id, id));
  await enqueueLessonJob(id, "materials");

  const updated = await loadLessonBundle(id);
  return NextResponse.json({
    lesson: updated ? bundleToWorkspace(updated) : null,
  });
};
