import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sessions, users, type User } from "@oku/db";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "./db";

const scrypt = promisify(scryptCb);

export const SESSION_COOKIE = "oku_session";
const SESSION_DAYS = 30;
const SCRYPT_KEYLEN = 64;

export type UserRole = "teacher" | "student";

export interface PublicUser {
  id: string;
  role: UserRole;
  displayName: string;
  username: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
};

export const verifyPassword = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
};

export const hashSessionToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  role: user.role,
  displayName: user.displayName,
  username: user.username,
});

export const createSession = async (userId: string): Promise<string> => {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = getDb();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });
  return token;
};

export const setSessionCookie = (
  response: NextResponse,
  token: string,
): void => {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
};

export const clearSessionCookie = (response: NextResponse): void => {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
};

export const readSessionToken = async (
  request?: Request,
): Promise<string | null> => {
  const headerCookie = request?.headers.get("cookie");
  if (headerCookie) {
    const match = headerCookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
    if (match) {
      return decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
    }
  }
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
};

export const getSessionUser = async (
  request?: Request,
): Promise<User | null> => {
  const token = await readSessionToken(request);
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0]?.user ?? null;
};

export const destroySession = async (request?: Request): Promise<void> => {
  const token = await readSessionToken(request);
  if (!token) return;
  const db = getDb();
  await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(token)));
};

export const requireUser = async (
  request: Request,
  role?: UserRole,
): Promise<{ user: User } | { error: NextResponse }> => {
  const user = await getSessionUser(request);
  if (!user) {
    return {
      error: NextResponse.json({ error: "Sign in required" }, { status: 401 }),
    };
  }
  if (role && user.role !== role) {
    return {
      error: NextResponse.json(
        { error: `A ${role} account is required` },
        { status: 403 },
      ),
    };
  }
  return { user };
};

export const normalizeUsername = (raw: string): string =>
  raw.trim().toLowerCase();
