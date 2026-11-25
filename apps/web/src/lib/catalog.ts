import type { Book } from "@oku/db";
import type { BookStatus } from "@oku/shared-types";

export interface Subcategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  subcategories: Subcategory[];
}

/** A stored book plus the shelf names a reader sees. */
export interface LibraryBook extends Book {
  categoryName: string;
  subcategoryName: string;
}

export const SCHOOL_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

/** Words already used on the shelf, the filters, and the book page. */
export const bookStatusLabel = (status: BookStatus): string => {
  if (status === "review") return "In review";
  if (status === "published") return "Published";
  return "Draft";
};

/** Metadata fields a contents or specials save sends with its own changes. */
export const libraryBookPutFields = (book: LibraryBook) => ({
  title: book.title,
  authors: book.authors,
  language: book.language,
  categoryId: book.categoryId,
  subcategoryId: book.subcategoryId,
  newSubcategory: "",
  schoolTextbook: book.isSchoolTextbook,
  grade: book.grade === null ? "" : String(book.grade),
  publishedYear:
    book.publishedYear === null ? "" : String(book.publishedYear),
});

export const languageName = (language: string): string => {
  if (language === "ky") return "Kyrgyz";
  if (language === "ru") return "Russian";
  return language.toUpperCase();
};

/** One line for a library card or a book header. */
export const shelfLine = (book: {
  language: string;
  categoryName: string;
  subcategoryName: string;
  isSchoolTextbook: boolean;
  grade: number | null;
  publishedYear: number | null;
}): string => {
  const parts = [
    languageName(book.language),
    book.categoryName,
    book.subcategoryName,
  ];
  if (book.isSchoolTextbook && book.grade !== null) {
    parts.push(`grade\u00A0${book.grade}`);
  }
  if (book.publishedYear !== null) {
    parts.push(String(book.publishedYear));
  }
  return parts.join(" · ");
};

export type ShelfLanguage = "all" | "ky" | "ru";

export type ShelfStatus = "all" | BookStatus;

/** What the shelf is narrowed to. Empty text and "all" mean the whole list. */
export interface LibraryShelfQuery {
  text: string;
  language: ShelfLanguage;
  status: ShelfStatus;
  categoryId: string;
  subcategoryId: string;
  grade: number | null;
}

/** The fields a shelf search can see. */
export interface ShelfMatch {
  title: string;
  authors: string[];
  language: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  status: BookStatus;
  isSchoolTextbook: boolean;
  grade: number | null;
  publishedYear: number | null;
}

export const EMPTY_SHELF_QUERY: LibraryShelfQuery = {
  text: "",
  language: "all",
  status: "all",
  categoryId: "",
  subcategoryId: "",
  grade: null,
};

export const shelfQueryActive = (query: LibraryShelfQuery): boolean =>
  query.text.trim() !== "" ||
  query.language !== "all" ||
  query.status !== "all" ||
  query.categoryId !== "" ||
  query.subcategoryId !== "" ||
  query.grade !== null;

/** Grades that appear on school textbooks, low to high. */
export const gradesOnShelf = (
  books: readonly Pick<ShelfMatch, "isSchoolTextbook" | "grade">[],
): number[] => {
  const found = new Set<number>();
  for (const book of books) {
    if (book.isSchoolTextbook && book.grade !== null) {
      found.add(book.grade);
    }
  }
  return [...found].sort((left, right) => left - right);
};

const shelfHaystack = (book: ShelfMatch): string =>
  [
    book.title,
    book.authors.join(" "),
    languageName(book.language),
    book.categoryName,
    book.subcategoryName,
    book.status === "review" ? "in review" : book.status,
    book.publishedYear === null ? "" : String(book.publishedYear),
    book.isSchoolTextbook && book.grade !== null ? String(book.grade) : "",
  ]
    .join(" ")
    .toLocaleLowerCase();

const matchesText = (book: ShelfMatch, text: string): boolean => {
  const tokens = text.trim().toLocaleLowerCase().split(/\s+/);
  if (tokens.length === 1 && tokens[0] === "") return true;
  const haystack = shelfHaystack(book);
  return tokens.every((token) => haystack.includes(token));
};

const bookMatchesShelf = (
  book: ShelfMatch,
  query: LibraryShelfQuery,
): boolean => {
  if (query.language !== "all" && book.language !== query.language) return false;
  if (query.status !== "all" && book.status !== query.status) return false;
  if (query.categoryId !== "" && book.categoryId !== query.categoryId) {
    return false;
  }
  if (query.subcategoryId !== "" && book.subcategoryId !== query.subcategoryId) {
    return false;
  }
  if (query.grade !== null && (!book.isSchoolTextbook || book.grade !== query.grade)) {
    return false;
  }
  return matchesText(book, query.text);
};

export const filterLibrary = <T extends ShelfMatch>(
  books: readonly T[],
  query: LibraryShelfQuery,
): T[] => books.filter((book) => bookMatchesShelf(book, query));
