import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";
import { getEnv } from "@/lib/env";

export const POST = async (request: Request): Promise<NextResponse> => {
  const body = (await request.json()) as { token?: string };
  const expected = getEnv().adminToken;

  if (!body.token || body.token !== expected) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, body.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
};
