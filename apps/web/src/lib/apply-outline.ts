import { bookPages } from "@oku/db";
import {
  applyContentsOutline,
  type ContentsEntry,
  type PageExtractedJson,
} from "@oku/shared-types";
import { eq } from "drizzle-orm";
import { getDb } from "./db";

interface ParsedPage {
  id: string;
  json: PageExtractedJson;
}

/**
 * Write a contents outline onto digitized pages and persist the rows that changed.
 * Returns how many unit headers were updated.
 */
export const applyOutlineToPages = async (
  pages: ParsedPage[],
  entries: ContentsEntry[],
): Promise<number> => {
  const applied = applyContentsOutline(
    pages.map((page) => page.json),
    entries,
  );
  const db = getDb();
  for (let index = 0; index < pages.length; index += 1) {
    const before = pages[index];
    const after = applied.pages[index];
    if (!before || !after || before.json === after) {
      continue;
    }
    await db
      .update(bookPages)
      .set({ extractedJson: after, updatedAt: new Date() })
      .where(eq(bookPages.id, before.id));
  }
  return applied.updatedHeaders;
};
