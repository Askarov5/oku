import { users } from "@oku/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  createSession,
  hashPassword,
  normalizeUsername,
  setSessionCookie,
  toPublicUser,
  type UserRole,
} from "@/lib/user-session";

interface RegisterBody {
  role?: UserRole;
  username?: string;
  displayName?: string;
  password?: string;
}

export const POST = async (request: Request): Promise<NextResponse> => {
  const body = (await request.json()) as RegisterBody;
  const role = body.role;
  const username = normalizeUsername(body.username ?? "");
  const displayName = (body.displayName ?? "").trim();
  const password = body.password ?? "";

  if (role !== "teacher" && role !== "student") {
    return NextResponse.json({ error: "Role must be teacher or student" }, { status: 400 });
  }
  if (!username || username.length < 3) {
    return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({
      role,
      username,
      displayName,
      passwordHash,
    })
    .returning();

  if (!user) {
    return NextResponse.json({ error: "Could not create account" }, { status: 500 });
  }

  const token = await createSession(user.id);
  const response = NextResponse.json({ user: toPublicUser(user) });
  setSessionCookie(response, token);
  return response;
};
