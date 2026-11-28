import { NextResponse } from "next/server";
import { clearSessionCookie, destroySession } from "@/lib/user-session";

export const POST = async (request: Request): Promise<NextResponse> => {
  await destroySession(request);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
};
