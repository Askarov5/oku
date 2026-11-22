import { bookPages, books, ingestionJobs, units } from "@oku/db";
import { asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { bookStoragePrefix } from "@/lib/book-files";
import { parseBookUpload } from "@/lib/book-upload";
import type { BookUploadFields } from "@/lib/book-upload";
import {
  findLibraryBook,
  findOrCreateSubcategory,
  listCategories,
} from "@/lib/catalog-db";
import { getDb } from "@/lib/db";
import { deletePrefix } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ bookId: string }>;
}

export const GET = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  const { bookId } = await context.params;
  const db = getDb();
  const book = await findLibraryBook(bookId);

  if (!book) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const pages = await db
    .select()
    .from(bookPages)
    .where(eq(bookPages.bookId, bookId))
    .orderBy(asc(bookPages.pageNumber));

  const jobs = await db
    .select()
    .from(ingestionJobs)
    .where(eq(ingestionJobs.bookId, bookId))
    .orderBy(desc(ingestionJobs.createdAt));

  const bookUnits = await db
    .select()
    .from(units)
    .where(eq(units.bookId, bookId))
    .orderBy(asc(units.orderIndex));

  return NextResponse.json({ book, pages, jobs, units: bookUnits });
};

interface BookEditBody extends BookUploadFields {
  title: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readBookEdit = async (request: Request): Promise<BookEditBody | null> => {
  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return null;
  }
  return {
    title: typeof payload.title === "string" ? payload.title : "",
    authors: Array.isArray(payload.authors)
      ? payload.authors.filter((item): item is string => typeof item === "string")
      : [],
    language: typeof payload.language === "string" ? payload.language : "",
    categoryId: typeof payload.categoryId === "string" ? payload.categoryId : "",
    subcategoryId:
      typeof payload.subcategoryId === "string" ? payload.subcategoryId : "",
    newSubcategory:
      typeof payload.newSubcategory === "string" ? payload.newSubcategory : "",
    schoolTextbook: payload.schoolTextbook === true,
    grade: typeof payload.grade === "string" ? payload.grade : "",
    publishedYear:
      typeof payload.publishedYear === "string" ? payload.publishedYear : "",
  };
};

/** Updates shelf details. The stored PDF, cover, and ingested pages stay as they are. */
export const PUT = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  const { bookId } = await context.params;
  const existing = await findLibraryBook(bookId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await readBookEdit(request);
  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const title = body.title.trim();
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const categories = await listCategories();
  const parsed = parseBookUpload(body, categories);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const subcategoryId =
    parsed.value.subcategoryId ??
    (parsed.value.newSubcategory
      ? await findOrCreateSubcategory(
          parsed.value.categoryId,
          parsed.value.newSubcategory,
        )
      : null);
  if (!subcategoryId) {
    return NextResponse.json({ error: "Choose a subcategory" }, { status: 400 });
  }

  const db = getDb();
  await db
    .update(books)
    .set({
      title,
      authors: parsed.value.authors,
      language: parsed.value.language,
      categoryId: parsed.value.categoryId,
      subcategoryId,
      isSchoolTextbook: parsed.value.isSchoolTextbook,
      grade: parsed.value.grade,
      publishedYear: parsed.value.publishedYear,
      updatedAt: new Date(),
    })
    .where(eq(books.id, bookId));

  const book = await findLibraryBook(bookId);
  return NextResponse.json({ book });
};

/** Folder that holds a book's PDF, cover, and page images, from its stored PDF URL. */
const mediaPrefixForBook = (sourcePdfUrl: string, bookId: string): string => {
  const marker = "/api/media/";
  const at = sourcePdfUrl.indexOf(marker);
  if (at >= 0) {
    const key = sourcePdfUrl.slice(at + marker.length);
    const slash = key.lastIndexOf("/");
    if (slash > 0) {
      return key.slice(0, slash);
    }
  }
  return bookStoragePrefix(bookId);
};

/** Removes the book, its pages/jobs/units (cascade), and local media files. */
export const DELETE = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  const { bookId } = await context.params;
  const existing = await findLibraryBook(bookId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const mediaPrefix = mediaPrefixForBook(existing.sourcePdfUrl, bookId);
  const db = getDb();
  await db.delete(books).where(eq(books.id, bookId));
  try {
    await deletePrefix(mediaPrefix);
  } catch (error) {
    console.error(`Deleted book ${bookId} but media cleanup failed`, error);
  }

  return NextResponse.json({ ok: true, title: existing.title });
};
