import type { Book } from "@oku/db";

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
