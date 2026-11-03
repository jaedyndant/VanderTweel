import { db } from "@/db/client";
import { auditLog } from "@/db/schema";

/**
 * Minimal who/what/when trail for money- and document-adjacent writes.
 * Not full event sourcing — just enough that "who changed this and when"
 * is answerable without digging through Vercel function logs. Never
 * blocks the actual mutation: a logging failure here should not fail the
 * underlying save (we've already written the real row by the time this
 * is called), so it's a fire-and-log, not fire-and-forget-silently.
 */
export async function recordAudit(
  actorAccountId: string,
  action: string,
  targetId: string,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorAccountId,
      action,
      targetId,
      meta: meta ? JSON.stringify(meta) : null,
    });
  } catch (error) {
    console.error("[audit] failed to record", action, targetId, error);
  }
}
