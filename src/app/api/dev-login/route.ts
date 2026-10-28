import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/db/client";
import { account, session as sessionTable } from "@/db/schema";
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

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await db.insert(sessionTable).values({
    sessionToken,
    accountId: row.id,
    expires,
  });

  const landing = row.role === "buyer" ? "/koper" : "/office";
  const res = NextResponse.redirect(new URL(landing, req.nextUrl.origin));
  res.cookies.set("__Secure-authjs.session-token", sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires,
  });
  return res;
}
