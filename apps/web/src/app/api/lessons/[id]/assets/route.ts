import { lessonAssets } from "@oku/db";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  bundleToWorkspace,
  loadLessonBundle,
  teacherCanMutate,
} from "@/lib/lesson-service";
import { uploadObject } from "@/lib/storage";
import { getDb } from "@/lib/db";
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

  const form = await request.formData();
  const kindRaw = String(form.get("kind") ?? "image");
  const name = String(form.get("name") ?? "attachment");
  const notesText = form.get("notesText");
  const includeAsSlide = String(form.get("includeAsSlide") ?? "false") === "true";
  const useInAi = String(form.get("useInAi") ?? "true") !== "false";
  const file = form.get("file");

  const kind =
    kindRaw === "pdf" || kindRaw === "note" || kindRaw === "image"
      ? kindRaw
      : kindRaw === "pdf_slides"
        ? "pdf"
        : kindRaw === "notes"
          ? "note"
          : "image";

  let url: string | null = null;
  const assetId = randomUUID();

  if (kind !== "note" && file instanceof File && file.size > 0) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const ext =
      file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf("."))
        : kind === "pdf"
          ? ".pdf"
          : ".bin";
    url = await uploadObject({
      key: `lessons/${id}/${assetId}${ext}`,
      body: bytes,
      contentType: file.type || "application/octet-stream",
    });
  }

  const db = getDb();
  await db.insert(lessonAssets).values({
    id: assetId,
    lessonId: id,
    kind,
    name,
    url,
    notesText: typeof notesText === "string" ? notesText : null,
    includeAsSlide,
    useInAi,
  });

  const updated = await loadLessonBundle(id);
  return NextResponse.json({
    lesson: updated ? bundleToWorkspace(updated) : null,
  });
};
