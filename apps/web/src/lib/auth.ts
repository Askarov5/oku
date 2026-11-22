import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getEnv } from "./env";

export const ADMIN_COOKIE = "oku_admin_token";

export const isAuthorized = async (
  request?: Request,
): Promise<boolean> => {
  const expected = getEnv().adminToken;
  const headerToken = request?.headers.get("x-admin-token");
  if (headerToken && headerToken === expected) {
    return true;
  }

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ADMIN_COOKIE)?.value;
  return cookieToken === expected;
};

export const unauthorized = (): NextResponse =>
  NextResponse.json({ error: "unauthorized" }, { status: 401 });
