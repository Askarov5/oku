import { users } from "@oku/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  createSession,
  normalizeUsername,
  setSessionCookie,
  toPublicUser,
  verifyPassword,
} from "@/lib/user-session";

interface LoginBody {
  username?: string;
  password?: string;
}

export const POST = async (request: Request): Promise<NextResponse> => {
  const body = (await request.json()) as LoginBody;
  const username = normalizeUsername(body.username ?? "");
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = await createSession(user.id);
  const response = NextResponse.json({ user: toPublicUser(user) });
  setSessionCookie(response, token);
  return response;
};
