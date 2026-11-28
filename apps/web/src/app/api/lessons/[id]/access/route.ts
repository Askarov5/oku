import { NextResponse } from "next/server";
import {
  hasActiveJob,
  loadLessonAccess,
  loadLessonBundle,
  setLessonAccess,
  teacherCanMutate,
  workspaceHasMaterials,
  bundleToWorkspace,
} from "@/lib/lesson-service";
import type { LessonAccess } from "@/lib/lesson-studio";
import { requireUser } from "@/lib/user-session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ACCESS_VALUES: LessonAccess[] = ["draft", "private", "public"];

export const POST = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const body = (await request.json()) as { access?: string };
  const access = body.access;
  if (!access || !ACCESS_VALUES.includes(access as LessonAccess)) {
    return NextResponse.json(
      { error: "access must be draft, private, or public" },
      { status: 400 },
    );
  }

  const [accessRow, busy, bundle] = await Promise.all([
    loadLessonAccess(id),
    hasActiveJob(id),
    loadLessonBundle(id),
  ]);
  if (!accessRow || !teacherCanMutate(accessRow, auth.user.id)) {
    return NextResponse.json(
      {
        error: accessRow?.isSample
          ? "Sample lesson is read-only"
          : "Lesson not found",
      },
      { status: accessRow ? 403 : 404 },
    );
  }

  if (busy) {
    return NextResponse.json(
      { error: "Wait for the current generation job to finish" },
      { status: 409 },
    );
  }

  const nextAccess = access as LessonAccess;
  if (nextAccess === "private" || nextAccess === "public") {
    const workspace = bundle ? bundleToWorkspace(bundle) : null;
    if (!workspace || !workspaceHasMaterials(workspace)) {
      return NextResponse.json(
        {
          error:
            "Add slides, a quiz, or homework before setting Private or Public",
        },
        { status: 409 },
      );
    }
  }

  const lesson = await setLessonAccess(id, nextAccess);
  return NextResponse.json({ lesson });
};
