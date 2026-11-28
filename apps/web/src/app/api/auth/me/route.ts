import { NextResponse } from "next/server";
import { getSessionUser, toPublicUser } from "@/lib/user-session";

export const GET = async (request: Request): Promise<NextResponse> => {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user: toPublicUser(user) });
};
