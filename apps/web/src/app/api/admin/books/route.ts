import { bookPages, books, ingestionJobs } from "@oku/db";
import { NextResponse } from "next/server";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { digitizePageSeeds } from "@/lib/book-page-range";
import { parseBookUpload } from "@/lib/book-upload";
import {
  COVER_MAX_BYTES,
  bookStoragePrefix,
  coverExtension,
} from "@/lib/book-files";
import { findOrCreateSubcategory, listCategories, listLibraryBooks } from "@/lib/catalog-db";
import { getDb } from "@/lib/db";
import { countPdfPages } from "@/lib/pdf";
import { uploadObject } from "@/lib/storage";

/*
 * Stores the preview image the upload form made from the first page.
 * The preview is optional: a missing or unusable one never blocks the upload.
 */
const saveCover = async (
  bookId: string,
  cover: FormDataEntryValue | null,
): Promise<string | null> => {
  if (!(cover instanceof File)) {
    return null;
  }
  const extension = coverExtension(cover.type);
  if (!extension || cover.size === 0 || cover.size > COVER_MAX_BYTES) {
    return null;
  }
  return uploadObject({
    key: `${bookStoragePrefix(bookId)}/cover.${extension}`,
    body: Buffer.from(await cover.arrayBuffer()),
    contentType: cover.type,
  });
};

export const GET = async (request: Request): Promise<NextResponse> => {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  const [libraryBooks, categories] = await Promise.all([
    listLibraryBooks(),
    listCategories(),
  ]);
  return NextResponse.json({ books: libraryBooks, categories });
};

export const POST = async (request: Request): Promise<NextResponse> => {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    const pageStartRaw = String(form.get("pageStart") ?? "").trim();
    const pageEndRaw = String(form.get("pageEnd") ?? "").trim();
    const categories = await listCategories();
    const parsed = parseBookUpload(
      {
        authors: form.getAll("authors").map((value) => String(value)),
        language: String(form.get("language") ?? "ky"),
        categoryId: String(form.get("categoryId") ?? ""),
        subcategoryId: String(form.get("subcategoryId") ?? ""),
        newSubcategory: String(form.get("newSubcategory") ?? ""),
        schoolTextbook: form.get("schoolTextbook") === "true",
        grade: String(form.get("grade") ?? ""),
        publishedYear: String(form.get("publishedYear") ?? ""),
      },
      categories,
    );

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let totalPages: number;
    try {
      totalPages = await countPdfPages(bytes);
    } catch {
      return NextResponse.json(
        { error: "This file is not a readable PDF" },
        { status: 400 },
      );
    }
    const range = digitizePageSeeds(totalPages, pageStartRaw, pageEndRaw);
    if (!range.ok) {
      return NextResponse.json({ error: range.error }, { status: 400 });
    }
    const { pageStart, pageEnd, pages } = range;

    const db = getDb();
    const bookId = crypto.randomUUID();
    const subcategoryId =
      parsed.value.subcategoryId ??
      (parsed.value.newSubcategory
        ? await findOrCreateSubcategory(
            parsed.value.categoryId,
            parsed.value.newSubcategory,
          )
        : null);
    if (!subcategoryId) {
      return NextResponse.json(
        { error: "Choose a subcategory" },
        { status: 400 },
      );
    }
    // The original PDF is stored unchanged; the worker reads it and the admin can open it.
    const sourcePdfUrl = await uploadObject({
      key: `${bookStoragePrefix(bookId)}/source.pdf`,
      body: Buffer.from(bytes),
      contentType: "application/pdf",
    });
    const coverImageUrl = await saveCover(bookId, form.get("cover"));

    await db.insert(books).values({
      id: bookId,
      countryCode: "kg",
      categoryId: parsed.value.categoryId,
      subcategoryId,
      isSchoolTextbook: parsed.value.isSchoolTextbook,
      grade: parsed.value.grade,
      publishedYear: parsed.value.publishedYear,
      authors: parsed.value.authors,
      language: parsed.value.language,
      title,
      sourcePdfUrl,
      coverImageUrl,
      isCanonical: true,
      status: "draft",
    });

    // Every PDF page is kept on the book; only the digitize range is queued for AI.
    await db.insert(bookPages).values(
      pages.map((page) => ({
        bookId,
        pageNumber: page.pageNumber,
        status: page.status,
        stage: page.stage,
      })),
    );

    const [job] = await db
      .insert(ingestionJobs)
      .values({
        bookId,
        status: "queued",
        pageStart,
        pageEnd,
        totalPages: pageEnd - pageStart + 1,
        completedPages: 0,
        failedPages: 0,
      })
      .returning();

    return NextResponse.json({
      bookId,
      jobId: job?.id,
      totalPages,
      pageStart,
      pageEnd,
    });
  } catch (error) {
    console.error("POST /api/admin/books failed", error);
    return NextResponse.json(
      { error: "Upload failed. Check the server log and try again." },
      { status: 500 },
    );
  }
};
