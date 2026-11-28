import { NextResponse } from "next/server";
import {
  applyLessonPatch,
  bundleToWorkspace,
  deleteLesson,
  hasActiveJob,
  loadLessonAccess,
  loadLessonBundle,
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
  const body = (await request.json()) as PatchLessonBody;
  const [access, busy] = await Promise.all([
    loadLessonAccess(id),
    hasActiveJob(id),
  ]);
  if (!access || !teacherCanMutate(access, auth.user.id)) {
    return NextResponse.json(
      {
        error: access?.isSample
          ? "Sample lesson is read-only"
          : "Lesson not found",
      },
      { status: access ? 403 : 404 },
    );
  }

  if (busy) {
    return NextResponse.json(
      { error: "Wait for the current generation job to finish" },
      { status: 409 },
    );
  }

  await applyLessonPatch(id, body);

  // Quiz rows can receive new ids. Slide and plan edits are already on screen.
  if (body.questions !== undefined || body.homework !== undefined) {
    const updated = await loadLessonBundle(id);
    return NextResponse.json({
      lesson: updated ? bundleToWorkspace(updated) : null,
    });
  }

  return NextResponse.json({ ok: true });
};

export const DELETE = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const access = await loadLessonAccess(id);
  if (!access || !teacherCanMutate(access, auth.user.id)) {
    return NextResponse.json(
      {
        error: access?.isSample
          ? "Sample lesson is read-only"
          : "Lesson not found",
      },
      { status: access ? 403 : 404 },
    );
  }

  await deleteLesson(id);
  return NextResponse.json({ ok: true });
};
