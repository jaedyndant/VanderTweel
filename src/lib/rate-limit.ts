import { db } from "@/db/client";
import { rateLimitHit } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * DB-backed fixed-window rate limiter. No new infra (Upstash/Redis) —
 * Neon Postgres is already the one store every Vercel lambda instance
 * shares, which an in-memory counter cannot be (each invocation may be a
 * cold-started, independent process).
 *
 * Fixed window, not sliding: simpler, and good enough for "stop an
 * email-bombing / brute-force burst", not for exact-precision throttling.
 *
 * @param bucketKey stable key for the thing being limited, e.g.
 *   `signin:ip:1.2.3.4` or `signin:email:x@y.com`. Callers should check
 *   both an IP-based and an identity-based bucket so neither alone is a
 *   full bypass (shared IP vs. rotating IP).
 * @param limit max hits allowed inside the window
 * @param windowSeconds window length in seconds
 * @returns true if this call is allowed, false if the bucket is over limit
 */
export async function checkRateLimit(
  bucketKey: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const now = new Date();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

  const rows = await db
    .insert(rateLimitHit)
    .values({ bucketKey, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitHit.bucketKey, rateLimitHit.windowStart],
      set: { count: sql`${rateLimitHit.count} + 1` },
    })
    .returning({ count: rateLimitHit.count });

  const count = rows[0]?.count ?? 1;
  return count <= limit;
}

/** Best-effort IP extraction behind Vercel's proxy. Never trust a client-set header alone for anything security-critical beyond rate limiting. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
