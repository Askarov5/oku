import { lessons } from "@oku/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  bundleToWorkspace,
  hasActiveJob,
  loadLessonBundle,
  replaceQuestions,
  teacherCanAccess,
  teacherCanMutate,
  type PatchLessonBody,
} from "@/lib/lesson-service";
import { requireUser } from "@/lib/user-session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const bundle = await loadLessonBundle(id);
  if (!bundle || !teacherCanAccess(bundle.lesson, auth.user.id)) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  return NextResponse.json({ lesson: bundleToWorkspace(bundle) });
};

export const PATCH = async (
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

  if (await hasActiveJob(id)) {
    return NextResponse.json(
      { error: "Wait for the current generation job to finish" },
      { status: 409 },
    );
  }

  const body = (await request.json()) as PatchLessonBody;
  const db = getDb();
  await db
    .update(lessons)
    .set({
      title: body.title ?? bundle.lesson.title,
      planBlocks: body.planBlocks ?? bundle.lesson.planBlocks,
      slides: body.slides ?? bundle.lesson.slides,
      homework: body.homework ?? bundle.lesson.homework,
      deliverables: body.deliverables ?? bundle.lesson.deliverables,
      creativeAngle: body.creativeAngle ?? bundle.lesson.creativeAngle,
      audience: body.audience ?? bundle.lesson.audience,
      amountOfLessons: body.amountOfLessons ?? bundle.lesson.amountOfLessons,
      minutesPerLesson: body.minutesPerLesson ?? bundle.lesson.minutesPerLesson,
      updatedAt: new Date(),
    })
    .where(eq(lessons.id, id));

  if (body.questions) {
    await replaceQuestions(id, body.questions);
  }

  const updated = await loadLessonBundle(id);
  return NextResponse.json({
    lesson: updated ? bundleToWorkspace(updated) : null,
  });
};
