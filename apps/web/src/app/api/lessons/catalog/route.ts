import { NextResponse } from "next/server";
import { loadStudioCatalog } from "@/lib/lesson-grounding";

/** Catalog of digitized books and sample books for lesson creation. */
export const GET = async (): Promise<NextResponse> => {
  try {
    const books = await loadStudioCatalog();
    return NextResponse.json({ books });
  } catch {
    return NextResponse.json({ books: [] });
  }
};
