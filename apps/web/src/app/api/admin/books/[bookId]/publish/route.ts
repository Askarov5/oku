import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { publishBook } from "@/lib/publish";

interface RouteContext {
  params: Promise<{ bookId: string }>;
}

export const POST = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  const denied = await requireAdmin(request);
  if (denied) {
    return denied;
  }

  const { bookId } = await context.params;

  try {
    const result = await publishBook(bookId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "publish failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
};
