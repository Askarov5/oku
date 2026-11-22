import { NextResponse } from "next/server";
import { readLocalObject } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ key: string[] }>;
}

const contentTypeFor = (key: string): string => {
  if (key.endsWith(".pdf")) return "application/pdf";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".png")) return "image/png";
  return "application/octet-stream";
};

export const GET = async (
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> => {
  const { key: parts } = await context.params;
  const key = parts.join("/");
  const body = await readLocalObject(key);
  if (!body) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentTypeFor(key),
      "Cache-Control": "public, max-age=3600",
    },
  });
};
