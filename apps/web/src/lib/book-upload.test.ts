import { describe, expect, it } from "vitest";
import type { Category } from "./catalog";
import { parseBookUpload } from "./book-upload";
import type { BookUploadFields } from "./book-upload";

const categories: Category[] = [
  {
    id: "geography",
    name: "Geography",
    subcategories: [{ id: "political", name: "Political geography" }],
  },
];

const fields = (over: Partial<BookUploadFields> = {}): BookUploadFields => ({
  authors: ["Абдыкадыров А."],
  language: "ky",
  categoryId: "geography",
  subcategoryId: "political",
  newSubcategory: "",
  schoolTextbook: true,
  grade: "9",
  publishedYear: "2024",
  ...over,
});

describe("parseBookUpload", () => {
  it("keeps a school textbook's grade and year", () => {
    const result = parseBookUpload(fields(), categories, 2026);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.grade).toBe(9);
      expect(result.value.publishedYear).toBe(2024);
      expect(result.value.authors).toEqual(["Абдыкадыров А."]);
    }
  });

  it("drops the grade when the book is not a school textbook", () => {
    const result = parseBookUpload(
      fields({ schoolTextbook: false, grade: "9" }),
      categories,
      2026,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.grade).toBeNull();
      expect(result.value.isSchoolTextbook).toBe(false);
    }
  });

  it("reuses a division that already exists under the category", () => {
    const result = parseBookUpload(
      fields({ subcategoryId: "new", newSubcategory: "political geography" }),
      categories,
      2026,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.subcategoryId).toBe("political");
      expect(result.value.newSubcategory).toBeNull();
    }
  });

  it("accepts a new division", () => {
    const result = parseBookUpload(
      fields({ subcategoryId: "new", newSubcategory: "  Cartography  " }),
      categories,
      2026,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newSubcategory).toBe("Cartography");
    }
  });

  it("rejects a year after next year", () => {
    const result = parseBookUpload(fields({ publishedYear: "2099" }), categories, 2026);
    expect(result).toEqual({
      ok: false,
      error: "Year must be between 1800 and 2027",
    });
  });
});
