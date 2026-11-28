import { NextResponse } from "next/server";
import {
  bundleToWorkspace,
  ensureSampleLesson,
  loadLessonByShareCode,
} from "@/lib/lesson-service";

interface RouteContext {
  params: Promise<{ shareCode: string }>;
}

export const GET = async (
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  await ensureSampleLesson();
  const { shareCode } = await context.params;
  const bundle = await loadLessonByShareCode(shareCode);
  if (!bundle) {
    return NextResponse.json({ error: "Quiz code not found" }, { status: 404 });
  }
  return NextResponse.json({
    lesson: bundleToWorkspace(bundle, { hideAnswers: true }),
  });
};
