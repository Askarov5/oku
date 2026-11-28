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
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  await ensureSampleLesson();
  const { shareCode } = await context.params;
  const url = new URL(request.url);
  const placement =
    url.searchParams.get("placement") === "homework" ? "homework" : "live";
  const bundle = await loadLessonByShareCode(shareCode);
  if (!bundle) {
    return NextResponse.json({ error: "Quiz code not found" }, { status: 404 });
  }
  const workspace = bundleToWorkspace(bundle, { hideAnswers: true });
  return NextResponse.json({
    lesson: workspace,
    placement,
    questions:
      placement === "homework" ? workspace.homework : workspace.questions,
  });
};
