import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db, type PlatformTx } from "@/db/client";
import { account, buyer, buyerVilla, villa } from "@/db/schema";
import { managedAsset } from "@/db/files-schema";
import { mailOutbox, platformEvent } from "@/db/events-schema";
import { sendEmail } from "@/lib/mailer";

export async function queueDirectEmail(tx: PlatformTx, input: { idempotencyKey: string; recipient: string; subject: string; text: string; sourceType: string; sourceId: string }): Promise<string> {
  const [created] = await tx.insert(mailOutbox).values({ ...input, body: input.text }).onConflictDoNothing({ target: mailOutbox.idempotencyKey }).returning({ id: mailOutbox.id });
  if (created) return created.id;
  const [existing] = await tx.select({ id: mailOutbox.id }).from(mailOutbox).where(eq(mailOutbox.idempotencyKey, input.idempotencyKey));
  return existing.id;
}
async function stillAuthorized(row: typeof mailOutbox.$inferSelect) {
  if (!row.eventId) {
    const [recipient] = await db.select({id:account.id}).from(account).where(eq(account.email,row.recipient));
    return !!recipient;
  }
  if (!row.recipientAccountId) return false;
  const [event] = await db.select().from(platformEvent).where(eq(platformEvent.id, row.eventId));
  if (!event) return false;
  if (event.action.startsWith("file.") && event.action.includes("share")) {
    const [asset] = await db.select().from(managedAsset).where(eq(managedAsset.id,event.targetId));
    if (!asset || asset.archivedAt || asset.visibility!=="shared" || !asset.activeVersion) return false;
  }
  const targets = await db.select({ id: buyer.id }).from(buyer).innerJoin(account, eq(account.id, buyer.accountId)).innerJoin(buyerVilla, eq(buyerVilla.buyerId, buyer.id)).innerJoin(villa, eq(villa.id, buyerVilla.villaId))
    .where(and(eq(account.id, row.recipientAccountId), eq(account.email, row.recipient), eq(account.role, "buyer"), eq(villa.projectId, event.projectId), event.villaId ? eq(villa.id, event.villaId) : undefined)).limit(1);
  return targets.length > 0;
}
export async function dispatchMailOutbox(limit = 12): Promise<void> {
  // Bounded batches, leased claims and provider idempotency make overlapping
  // cron/after invocations safe. Permanent/ambiguous failures remain visible.
  await db.update(mailOutbox).set({status:"failed",lastError:"delivery_unconfirmed",leaseId:null}).where(and(eq(mailOutbox.status,"processing"),sql`${mailOutbox.attempts} >= 8`,lt(mailOutbox.lockedAt,new Date(Date.now()-5*60_000))));
  for (let index = 0; index < Math.min(limit, 30); index++) {
    const leaseId = randomUUID();
    const row = await db.transaction(async tx => {
      const [candidate] = await tx.select().from(mailOutbox).where(and(lt(mailOutbox.attempts, 8), or(
        and(eq(mailOutbox.status, "pending"), lte(mailOutbox.nextAttemptAt, new Date())),
        and(eq(mailOutbox.status, "processing"), lt(mailOutbox.lockedAt, new Date(Date.now() - 5 * 60_000))),
      ))).orderBy(mailOutbox.createdAt).limit(1).for("update", { skipLocked: true });
      if (!candidate) return null;
      const [claimed] = await tx.update(mailOutbox).set({ status: "processing", leaseId, lockedAt: new Date(), attempts: candidate.attempts + 1 }).where(eq(mailOutbox.id, candidate.id)).returning();
      return claimed;
    });
    if (!row) break;
    try {
      if (!await stillAuthorized(row)) {
        await db.update(mailOutbox).set({ status: "cancelled", lastError: "recipient_access_removed", leaseId: null }).where(and(eq(mailOutbox.id, row.id), eq(mailOutbox.leaseId, leaseId)));
        continue;
      }
      await sendEmail({ to: row.recipient, subject: row.subject, text: row.body, idempotencyKey: row.idempotencyKey });
      await db.update(mailOutbox).set({ status: "sent", sentAt: new Date(), lastError: null, leaseId: null }).where(and(eq(mailOutbox.id, row.id), eq(mailOutbox.leaseId, leaseId)));
    } catch (error) {
      const code = error instanceof Error && /^mail_(?:not_configured|provider_\d+)$/.test(error.message) ? error.message : "delivery_unconfirmed";
      await db.update(mailOutbox).set({ status: row.attempts >= 8 ? "failed" : "pending", nextAttemptAt: new Date(Date.now() + Math.min(60 * 60_000, 30_000 * 2 ** row.attempts)), lastError: code, leaseId: null }).where(and(eq(mailOutbox.id, row.id), eq(mailOutbox.leaseId, leaseId)));
    }
  }
}
