import { bookPages, books, ingestionJobs } from "@oku/db";
import {
  parsePageRoleAssignments,
  resolvePageRoles,
} from "@oku/shared-types";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
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
  const denied = await requireAdmin(request);
  if (denied) {
    return denied;
  }

  const [libraryBooks, categories] = await Promise.all([
    listLibraryBooks(),
    listCategories(),
  ]);
  return NextResponse.json({ books: libraryBooks, categories });
};

export const POST = async (request: Request): Promise<NextResponse> => {
  const denied = await requireAdmin(request);
  if (denied) {
    return denied;
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    const pageStartRaw = String(form.get("pageStart") ?? "").trim();
    const pageEndRaw = String(form.get("pageEnd") ?? "").trim();
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    const [categories, bytes] = await Promise.all([
      listCategories(),
      file.arrayBuffer(),
    ]);
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

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    let totalPages: number;
    try {
      totalPages = await countPdfPages(bytes);
    } catch {
      return NextResponse.json(
        { error: "This file is not a readable PDF" },
        { status: 400 },
      );
    }

    const roleFields = parsePageRoleAssignments({
      cover: String(form.get("roleCover") ?? ""),
      tableOfContents: String(form.get("roleTableOfContents") ?? ""),
      glossary: String(form.get("roleGlossary") ?? ""),
      appendices: String(form.get("roleAppendices") ?? ""),
      answers: String(form.get("roleAnswers") ?? ""),
    });
    if (!roleFields.ok) {
      return NextResponse.json({ error: roleFields.error }, { status: 400 });
    }
    const roles = resolvePageRoles(roleFields.assignments, totalPages);
    if (!roles.ok) {
      return NextResponse.json({ error: roles.error }, { status: 400 });
    }

    const range = digitizePageSeeds(
      totalPages,
      pageStartRaw,
      pageEndRaw,
      roles.byPage,
    );
    if (!range.ok) {
      return NextResponse.json({ error: range.error }, { status: 400 });
    }
    const { pageStart, pageEnd, pages, queuedPages, bodyConversionQueued } =
      range;

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
    // The cover is a separate object and does not depend on the PDF upload.
    const [sourcePdfUrl, coverImageUrl] = await Promise.all([
      uploadObject({
        key: `${bookStoragePrefix(bookId)}/source.pdf`,
        body: Buffer.from(bytes),
        contentType: "application/pdf",
      }),
      saveCover(bookId, form.get("cover")),
    ]);

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
      digitizePageStart: pageStart,
      digitizePageEnd: pageEnd,
      bodyConversionQueued,
    });

    // Every PDF page is kept on the book; only queued pages start as pending.
    await db.insert(bookPages).values(
      pages.map((page) => ({
        bookId,
        pageNumber: page.pageNumber,
        status: page.status,
        stage: page.stage,
        pageRole: page.pageRole,
      })),
    );

    const jobPageStart = queuedPages[0] ?? pageStart;
    const jobPageEnd = queuedPages[queuedPages.length - 1] ?? pageEnd;
    const [job] = await db
      .insert(ingestionJobs)
      .values({
        bookId,
        status: "queued",
        pageStart: jobPageStart,
        pageEnd: jobPageEnd,
        pageNumbers: bodyConversionQueued ? null : queuedPages,
        totalPages: queuedPages.length,
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
      queuedPages,
      bodyConversionQueued,
      specialPageCount: bodyConversionQueued ? 0 : queuedPages.length,
    });
  } catch (error) {
    console.error("POST /api/admin/books failed", error);
    return NextResponse.json(
      { error: "Upload failed. Check the server log and try again." },
      { status: 500 },
    );
  }
};
