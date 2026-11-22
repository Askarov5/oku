import { books, categories, subcategories } from "@oku/db";
import type { Book } from "@oku/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Category, LibraryBook } from "./catalog";
import { getDb } from "./db";

interface ShelfRow {
  book: Book;
  categoryName: string;
  subcategoryName: string;
}

const toLibraryBook = (row: ShelfRow): LibraryBook => ({
  ...row.book,
  categoryName: row.categoryName,
  subcategoryName: row.subcategoryName,
});

const shelfQuery = () => {
  const db = getDb();
  return db
    .select({
      book: books,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
    })
    .from(books)
    .innerJoin(categories, eq(books.categoryId, categories.id))
    .innerJoin(subcategories, eq(books.subcategoryId, subcategories.id));
};

export const listCategories = async (): Promise<Category[]> => {
  const db = getDb();
  const categoryRows = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.name));
  const subcategoryRows = await db
    .select()
    .from(subcategories)
    .orderBy(asc(subcategories.name));
  return categoryRows.map((category) => ({
    id: category.id,
    name: category.name,
    subcategories: subcategoryRows
      .filter((row) => row.categoryId === category.id)
      .map((row) => ({ id: row.id, name: row.name })),
  }));
};

export const listLibraryBooks = async (): Promise<LibraryBook[]> => {
  const rows = await shelfQuery().orderBy(desc(books.createdAt));
  return rows.map(toLibraryBook);
};

export const findLibraryBook = async (
  bookId: string,
): Promise<LibraryBook | null> => {
  const [row] = await shelfQuery().where(eq(books.id, bookId)).limit(1);
  return row ? toLibraryBook(row) : null;
};

/** The division's id, creating it when this category does not have that name yet. */
export const findOrCreateSubcategory = async (
  categoryId: string,
  name: string,
): Promise<string> => {
  const db = getDb();
  const [existing] = await db
    .select({ id: subcategories.id })
    .from(subcategories)
    .where(
      and(
        eq(subcategories.categoryId, categoryId),
        sql`lower(${subcategories.name}) = ${name.toLowerCase()}`,
      ),
    )
    .limit(1);
  if (existing) {
    return existing.id;
  }
  try {
    const [created] = await db
      .insert(subcategories)
      .values({ categoryId, name })
      .returning({ id: subcategories.id });
    if (!created) {
      throw new Error("Could not add the division");
    }
    return created.id;
  } catch (error) {
    const [again] = await db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(
        and(
          eq(subcategories.categoryId, categoryId),
          sql`lower(${subcategories.name}) = ${name.toLowerCase()}`,
        ),
      )
      .limit(1);
    if (again) {
      return again.id;
    }
    throw error;
  }
};
