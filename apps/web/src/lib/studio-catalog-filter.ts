import type { StudioBookOption, StudioUnitOption } from "./lesson-studio";

export interface StudioCatalogFilters {
  query: string;
  language: "all" | "ky" | "ru" | "en";
  grade: "all" | number;
  category: "all" | string;
}

export interface StudioCatalogHit {
  book: StudioBookOption;
  unit: StudioUnitOption;
  unitIndex: number;
}

export const emptyStudioCatalogFilters = (): StudioCatalogFilters => ({
  query: "",
  language: "all",
  grade: "all",
  category: "all",
});

const normalize = (value: string): string => value.trim().toLowerCase();

const bookMatchesFilters = (
  book: StudioBookOption,
  filters: StudioCatalogFilters,
): boolean => {
  if (filters.language !== "all" && book.language !== filters.language) {
    return false;
  }
  if (filters.grade !== "all") {
    if (!book.isSchoolTextbook || book.grade !== filters.grade) {
      return false;
    }
  }
  if (filters.category !== "all" && book.categoryName !== filters.category) {
    return false;
  }
  return true;
};

const bookMatchesQuery = (
  book: StudioBookOption,
  query: string,
): boolean => {
  if (!query) return true;
  const haystack = [
    book.title,
    book.categoryName,
    book.subcategoryName,
    ...book.units.flatMap((unit) => [
      unit.title,
      unit.summary,
      unit.pageRangeLabel,
      ...unit.keyTerms,
    ]),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
};

const unitMatchesQuery = (
  unit: StudioUnitOption,
  query: string,
): boolean => {
  if (!query) return true;
  const haystack = [
    unit.title,
    unit.summary,
    unit.pageRangeLabel,
    ...unit.keyTerms,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
};

/** Books that match language/grade/category plus the search query. */
export const filterStudioBooks = (
  books: StudioBookOption[],
  filters: StudioCatalogFilters,
): StudioBookOption[] => {
  const query = normalize(filters.query);
  return books.filter(
    (book) => bookMatchesFilters(book, filters) && bookMatchesQuery(book, query),
  );
};

export const filterStudioCatalog = (
  books: StudioBookOption[],
  filters: StudioCatalogFilters,
): StudioCatalogHit[] => {
  const query = normalize(filters.query);
  const hits: StudioCatalogHit[] = [];

  for (const book of filterStudioBooks(books, filters)) {
    book.units.forEach((unit, unitIndex) => {
      if (!unitMatchesQuery(unit, query)) return;
      hits.push({ book, unit, unitIndex });
    });
  }

  return hits;
};

export const filterUnitsForBook = (
  book: StudioBookOption,
  query: string,
): StudioCatalogHit[] => {
  const normalized = normalize(query);
  return book.units
    .map((unit, unitIndex) => ({ book, unit, unitIndex }))
    .filter(({ unit }) => unitMatchesQuery(unit, normalized));
};

export const studioCatalogCategories = (
  books: StudioBookOption[],
): string[] =>
  [...new Set(books.map((book) => book.categoryName).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );

export const studioCatalogGrades = (books: StudioBookOption[]): number[] =>
  [
    ...new Set(
      books
        .filter((book) => book.isSchoolTextbook && book.grade !== null)
        .map((book) => book.grade as number),
    ),
  ].sort((a, b) => a - b);
