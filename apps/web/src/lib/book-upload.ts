import type { Category } from "./catalog";
import { SCHOOL_GRADES } from "./catalog";

export interface BookUploadFields {
  authors: string[];
  language: string;
  categoryId: string;
  subcategoryId: string;
  newSubcategory: string;
  schoolTextbook: boolean;
  grade: string;
  publishedYear: string;
}

export interface ParsedBookUpload {
  authors: string[];
  language: "ky" | "ru";
  categoryId: string;
  /** Set when the book uses a division that already exists. */
  subcategoryId: string | null;
  /** Set when the upload is adding a division under the category. */
  newSubcategory: string | null;
  isSchoolTextbook: boolean;
  grade: number | null;
  publishedYear: number | null;
}

export type BookUploadResult =
  | { ok: true; value: ParsedBookUpload }
  | { ok: false; error: string };

const NAME_LIMIT = 80;
const AUTHOR_LIMIT = 120;
const AUTHOR_COUNT = 8;

const clean = (value: string): string => value.trim().replace(/\s+/g, " ");

export const parseBookUpload = (
  fields: BookUploadFields,
  categories: Category[],
  nowYear = new Date().getFullYear(),
): BookUploadResult => {
  if (fields.language !== "ky" && fields.language !== "ru") {
    return { ok: false, error: "Language must be Kyrgyz or Russian" };
  }

  const category = categories.find((item) => item.id === fields.categoryId);
  if (!category) {
    return { ok: false, error: "Choose a category" };
  }

  const adding = fields.subcategoryId === "new";
  const nextName = clean(fields.newSubcategory);
  let subcategoryId: string | null = null;
  let newSubcategory: string | null = null;
  if (adding) {
    if (nextName.length < 2 || nextName.length > NAME_LIMIT) {
      return { ok: false, error: "Name the division" };
    }
    const existing = category.subcategories.find(
      (item) => item.name.toLowerCase() === nextName.toLowerCase(),
    );
    if (existing) {
      subcategoryId = existing.id;
    } else {
      newSubcategory = nextName;
    }
  } else {
    const subcategory = category.subcategories.find(
      (item) => item.id === fields.subcategoryId,
    );
    if (!subcategory) {
      return { ok: false, error: "Choose a subcategory" };
    }
    subcategoryId = subcategory.id;
  }

  const authors = fields.authors.map(clean).filter((name) => name.length > 0);
  if (authors.length > AUTHOR_COUNT) {
    return { ok: false, error: `A book can have up to ${AUTHOR_COUNT} authors` };
  }
  if (authors.some((name) => name.length > AUTHOR_LIMIT)) {
    return { ok: false, error: "An author name is too long" };
  }

  let grade: number | null = null;
  if (fields.schoolTextbook) {
    const parsed = Number(fields.grade);
    if (!SCHOOL_GRADES.some((item) => item === parsed)) {
      return { ok: false, error: "Choose a grade from 1 to 11" };
    }
    grade = parsed;
  }

  const yearText = fields.publishedYear.trim();
  let publishedYear: number | null = null;
  if (yearText) {
    const parsed = Number(yearText);
    const latest = nowYear + 1;
    if (!Number.isInteger(parsed) || parsed < 1800 || parsed > latest) {
      return { ok: false, error: `Year must be between 1800 and ${latest}` };
    }
    publishedYear = parsed;
  }

  return {
    ok: true,
    value: {
      authors,
      language: fields.language,
      categoryId: category.id,
      subcategoryId,
      newSubcategory,
      isSchoolTextbook: fields.schoolTextbook,
      grade,
      publishedYear,
    },
  };
};
