import { lessons } from "@oku/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loadLessonReading } from "@/lib/lesson-reading";
import { teacherCanAccess } from "@/lib/lesson-service";
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
  const db = getDb();
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, id))
    .limit(1);

  if (!lesson || !teacherCanAccess(lesson, auth.user.id)) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const reading = await loadLessonReading(lesson);
  return NextResponse.json({ reading });
};
