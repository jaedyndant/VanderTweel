import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const { GET } = handlers;

// Rate limit only the sign-in-request step (POST .../signin/resend), which
// is what actually sends an email through Resend and is the endpoint an
// attacker would hit to either email-bomb a target or burn through send
// quota. Two buckets so neither a shared IP nor a rotating IP alone is a
// full bypass: 5 requests/10min per IP, 3 requests/10min per target email.
export async function POST(req: NextRequest) {
  const isSigninRequest = req.nextUrl.pathname.startsWith("/api/auth/signin/");

  if (isSigninRequest) {
    const ip = clientIp(req);
    const ipOk = await checkRateLimit(`signin:ip:${ip}`, 5, 600);
    if (!ipOk) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Try again in a few minutes." },
        { status: 429 }
      );
    }

    // Inspect a clone so Auth.js receives the original body, encoding,
    // CSRF token and cookies. Rebuilding a URL-encoded request with
    // FormData would produce multipart bytes under the original header.
    let formData: FormData;
    try {
      formData = await req.clone().formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid sign-in request." },
        { status: 400 }
      );
    }
    const email = formData.get("email");
    if (typeof email === "string" && email) {
      const emailOk = await checkRateLimit(`signin:email:${email.trim().toLowerCase()}`, 3, 600);
      if (!emailOk) {
        return NextResponse.json(
          { error: "Too many sign-in attempts for this address. Try again in a few minutes." },
          { status: 429 }
        );
      }
    }
  }

  return handlers.POST(req);
}
