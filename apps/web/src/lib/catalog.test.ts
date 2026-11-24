import { describe, expect, it } from "vitest";
import type { ShelfMatch } from "./catalog";
import {
  EMPTY_SHELF_QUERY,
  filterLibrary,
  gradesOnShelf,
  shelfQueryActive,
} from "./catalog";

const book = (over: Partial<ShelfMatch> & Pick<ShelfMatch, "title">): ShelfMatch => ({
  authors: [],
  language: "ky",
  categoryId: "geography",
  categoryName: "Geography",
  subcategoryId: "political",
  subcategoryName: "Political geography",
  status: "review",
  isSchoolTextbook: true,
  grade: 9,
  publishedYear: 2009,
  ...over,
});

const shelf = [
  book({
    title: "География",
    authors: ["Ө.Бараталиев"],
    publishedYear: 2009,
  }),
  book({
    title: "Алгебра",
    authors: ["Иманалиев М"],
    categoryId: "maths",
    categoryName: "Maths",
    subcategoryId: "algebra",
    subcategoryName: "Algebra",
    publishedYear: 2000,
    status: "published",
  }),
  book({
    title: "Сонку тарых",
    authors: ["Өмүрзакова Т."],
    language: "ru",
    categoryId: "history",
    categoryName: "History",
    subcategoryId: "kyrgyzstan",
    subcategoryName: "History of Kyrgyzstan",
    grade: 9,
    publishedYear: 2017,
    status: "draft",
  }),
];

describe("filterLibrary", () => {
  it("returns the whole shelf when nothing is set", () => {
    expect(filterLibrary(shelf, EMPTY_SHELF_QUERY)).toHaveLength(3);
    expect(shelfQueryActive(EMPTY_SHELF_QUERY)).toBe(false);
  });

  it("matches a Kyrgyz title or author without caring about case", () => {
    expect(filterLibrary(shelf, { ...EMPTY_SHELF_QUERY, text: "география" }).map((item) => item.title)).toEqual([
      "География",
    ]);
    expect(filterLibrary(shelf, { ...EMPTY_SHELF_QUERY, text: "ӨМҮР" }).map((item) => item.title)).toEqual([
      "Сонку тарых",
    ]);
  });

  it("requires every word to match", () => {
    expect(
      filterLibrary(shelf, { ...EMPTY_SHELF_QUERY, text: "algebra 2000" }).map((item) => item.title),
    ).toEqual(["Алгебра"]);
    expect(filterLibrary(shelf, { ...EMPTY_SHELF_QUERY, text: "algebra 2017" })).toEqual([]);
  });

  it("narrows by language, status, subject, division, and grade", () => {
    expect(
      filterLibrary(shelf, { ...EMPTY_SHELF_QUERY, language: "ru" }).map((item) => item.title),
    ).toEqual(["Сонку тарых"]);
    expect(
      filterLibrary(shelf, { ...EMPTY_SHELF_QUERY, status: "published" }).map((item) => item.title),
    ).toEqual(["Алгебра"]);
    expect(
      filterLibrary(shelf, {
        ...EMPTY_SHELF_QUERY,
        categoryId: "geography",
        subcategoryId: "political",
      }).map((item) => item.title),
    ).toEqual(["География"]);
    expect(
      filterLibrary(shelf, { ...EMPTY_SHELF_QUERY, grade: 9, language: "ky" }).map(
        (item) => item.title,
      ),
    ).toEqual(["География", "Алгебра"]);
  });

  it("lists the grades that are actually on the shelf", () => {
    expect(gradesOnShelf(shelf)).toEqual([9]);
    expect(gradesOnShelf([book({ title: "Atlas", isSchoolTextbook: false, grade: null })])).toEqual(
      [],
    );
  });
});
