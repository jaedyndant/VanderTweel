import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { db } from "@/db/client";
import { account } from "@/db/schema";
import { eq } from "drizzle-orm";

// TEMPORARY, pre-launch only. Lets us demo the real deployed screens without
// a wired-up Resend account yet. Gated by DEV_LOGIN_SECRET so it is useless
// to anyone who doesn't already have that value. Remove this route entirely
// before Max's real buyers get real accounts (NFR 11.4 territory) — it is a
// deliberate backdoor and must not ship into the real production launch.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const email = req.nextUrl.searchParams.get("email");

  if (!secret || secret !== process.env.DEV_LOGIN_SECRET) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!email) {
    return NextResponse.json({ error: "missing email" }, { status: 400 });
  }

  const row = await db.query.account.findFirst({
    where: eq(account.email, email.trim().toLowerCase()),
  });
  if (!row) {
    return NextResponse.json({ error: "no such account" }, { status: 404 });
  }

  const sessionMaxAgeSeconds = 2 * 60 * 60; // 2 hours, matches the old dev-login expiry
  const isHttps = req.nextUrl.protocol === "https:";
  const cookieName = isHttps ? "__Secure-authjs.session-token" : "authjs.session-token";

  const token = await encode({
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
    maxAge: sessionMaxAgeSeconds,
    token: {
      sub: row.id,
      accountId: row.id,
      email: row.email,
      role: row.role,
    },
  });

  const landing = row.role === "buyer" ? "/koper" : "/office";
  const res = NextResponse.redirect(new URL(landing, req.nextUrl.origin));
  res.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
  return res;
}
