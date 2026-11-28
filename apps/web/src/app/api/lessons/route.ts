import { lessons } from "@oku/db";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveUnitForLesson } from "@/lib/lesson-grounding";
import {
  buildGrounding,
  bundleToWorkspace,
  enqueueLessonJob,
  ensureSampleLesson,
  listTeacherLessons,
  loadLessonBundle,
  newShareCode,
} from "@/lib/lesson-service";
import type { LessonDeliverableFlags, StudioAttachment } from "@/lib/lesson-studio";
import {
  DEFAULT_HOMEWORK_COUNT,
  DEFAULT_QUIZ_COUNT,
  DEFAULT_SLIDE_COUNT,
} from "@/lib/lesson-studio";
import { requireUser } from "@/lib/user-session";

export const GET = async (request: Request): Promise<NextResponse> => {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;

  await ensureSampleLesson();
  const items = await listTeacherLessons(auth.user.id);
  return NextResponse.json({ lessons: items });
};

interface CreateLessonBody {
  bookId?: string;
  unitId?: string;
  unitIndex?: number;
  audience?: string;
  amountOfLessons?: number;
  minutesPerLesson?: number;
  creativeAngle?: string;
  deliverables?: LessonDeliverableFlags;
  attachments?: StudioAttachment[];
}

export const POST = async (request: Request): Promise<NextResponse> => {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as CreateLessonBody;
  if (!body.bookId) {
    return NextResponse.json({ error: "bookId is required" }, { status: 400 });
  }

  const resolved = await resolveUnitForLesson({
    bookId: body.bookId,
    unitId: body.unitId,
    unitIndex: body.unitIndex ?? 0,
  });
  if (!resolved) {
    return NextResponse.json({ error: "Book or unit not found" }, { status: 404 });
  }

  const { book, unit } = resolved;
  const audience =
    (body.audience ?? "").trim() ||
    (book.isSchoolTextbook && book.grade !== null
      ? `Grade ${book.grade} school students`
      : `General learners — ${book.subcategoryName}`);
  const amountOfLessons = Math.min(6, Math.max(1, body.amountOfLessons ?? 1));
  const minutesPerLesson = Math.min(90, Math.max(20, body.minutesPerLesson ?? 45));
  const creativeAngle = (body.creativeAngle ?? "").trim();
  const deliverables: LessonDeliverableFlags = {
    slides: body.deliverables?.slides ?? true,
    kahootTest: body.deliverables?.kahootTest ?? true,
    homework: body.deliverables?.homework ?? true,
    slideCount: body.deliverables?.slideCount ?? DEFAULT_SLIDE_COUNT,
    quizCount: body.deliverables?.quizCount ?? DEFAULT_QUIZ_COUNT,
    homeworkCount: body.deliverables?.homeworkCount ?? DEFAULT_HOMEWORK_COUNT,
  };
  const noteAttachments = (body.attachments ?? [])
    .filter((item) => item.kind === "notes" && item.useInAi && item.notesText)
    .map((item) => item.notesText!)
    .slice(0, 6);

  const markdownExcerpt =
    "markdownExcerpt" in unit && typeof unit.markdownExcerpt === "string"
      ? unit.markdownExcerpt
      : unit.summary;

  const grounding = buildGrounding({
    book,
    unit,
    audience,
    amountOfLessons,
    minutesPerLesson,
    creativeAngle,
    noteAttachments,
    markdownExcerpt,
  });

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      book.id,
    );

  const db = getDb();
  const [lesson] = await db
    .insert(lessons)
    .values({
      shareCode: newShareCode(),
      teacherId: auth.user.id,
      bookId: isUuid ? book.id : null,
      unitKey: unit.id,
      unitTitle: unit.title,
      pageRangeLabel: unit.pageRangeLabel,
      bookTitle: book.title,
      language: book.language,
      audience,
      amountOfLessons,
      minutesPerLesson,
      creativeAngle,
      deliverables,
      stage: "generating_plan",
      title: unit.title,
      planBlocks: [],
      slides: [],
      homework: [],
      grounding,
      conceptId: null,
      isSample: false,
    })
    .returning();

  if (!lesson) {
    return NextResponse.json({ error: "Could not create lesson" }, { status: 500 });
  }

  await enqueueLessonJob(lesson.id, "plan");
  const bundle = await loadLessonBundle(lesson.id);
  return NextResponse.json(
    { lesson: bundle ? bundleToWorkspace(bundle) : null },
    { status: 201 },
  );
};
