import { and, eq } from "drizzle-orm";
import type { PlatformTx } from "@/db/client";
import { account, auditLog, buyer, buyerVilla, villa } from "@/db/schema";
import { platformEvent, eventRecipient, mailOutbox } from "@/db/events-schema";

export type PlatformEventInput = {
  actorId: string; projectId: string; villaId?: string | null; action: string; targetId: string;
  summary: string; notify: boolean; pmSafe: boolean; dedupeKey?: string; link?: string; subject?: string;
};
export async function writePlatformEvent(tx: PlatformTx, input: PlatformEventInput): Promise<string> {
  input = { ...input, link: input.link ?? `/koper${input.villaId ? `?villa=${input.villaId}` : ""}` };
  if (!input.summary.trim() || input.summary.length > 10_500) throw new Error("Invalid event summary");
  if (input.link && (!/^\/koper(?:\/|\?|$)/.test(input.link) || input.link.includes("\\") || /[\r\n]/.test(input.link))) throw new Error("Invalid notification link");
  const [actor] = await tx.select().from(account).where(eq(account.id, input.actorId));
  if (!actor || !["developer", "pm"].includes(actor.role)) throw new Error("Invalid event actor");
  const [event] = await tx.insert(platformEvent).values({
    actorId: actor.id, actorLabel: actor.displayName || (actor.role === "pm" ? "Project manager" : "Development team"),
    projectId: input.projectId, villaId: input.villaId, action: input.action, targetId: input.targetId,
    summary: input.summary, pmSafe: input.pmSafe, dedupeKey: input.dedupeKey, link: input.link,
  }).onConflictDoNothing({ target: platformEvent.dedupeKey }).returning();
  if (!event) {
    const [existing] = await tx.select().from(platformEvent).where(eq(platformEvent.dedupeKey, input.dedupeKey!));
    if (!existing || existing.actorId !== actor.id || existing.projectId !== input.projectId || existing.action !== input.action || existing.targetId !== input.targetId) throw new Error("Event retry conflict");
    return existing.id;
  }
  await tx.insert(auditLog).values({ actorAccountId: actor.id, action: input.action, targetId: input.targetId, meta: JSON.stringify({ eventId: event.id, projectId: input.projectId, villaId: input.villaId ?? null }) });
  if (!input.notify) return event.id;
  const rows = await tx.selectDistinct({ buyerId: buyer.id, accountId: account.id, email: account.email }).from(buyer)
    .innerJoin(account, eq(account.id, buyer.accountId)).innerJoin(buyerVilla, eq(buyerVilla.buyerId, buyer.id)).innerJoin(villa, eq(villa.id, buyerVilla.villaId))
    .where(and(eq(account.role, "buyer"), eq(villa.projectId, input.projectId), input.villaId ? eq(villa.id, input.villaId) : undefined));
  const base = process.env.APP_URL?.replace(/\/$/, "");
  for (const recipient of rows) {
    await tx.insert(eventRecipient).values({ eventId: event.id, buyerId: recipient.buyerId });
    // Missing deployment origin remains a visible delivery failure, never an
    // invented or attacker-controlled host. The record itself is durable.
    await tx.insert(mailOutbox).values({ eventId: event.id, recipientAccountId: recipient.accountId, recipient: recipient.email,
      subject: input.subject || "An update from your Van der Tweel team", body: `${input.summary}\n\n${base && input.link ? `${base}${input.link}` : "Sign in to your buyer platform to view this update."}`,
      sourceType: "event", sourceId: event.id, idempotencyKey: `event:${event.id}:${recipient.accountId}` });
  }
  return event.id;
}
