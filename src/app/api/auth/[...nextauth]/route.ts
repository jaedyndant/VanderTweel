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

    // Reading the form body here to key a second bucket on the target
    // email, then reconstructing an equivalent request for the real
    // handler (request bodies can only be read once).
    const formData = await req.formData();
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

    const rebuilt = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: formData,
    });
    return handlers.POST(rebuilt as NextRequest);
  }

  return handlers.POST(req);
}
