import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/mailer", () => ({ sendEmail: mocks.sendEmail }));
import { db } from "@/db/client";
import { account, project, villa, buyer, buyerVilla } from "@/db/schema";
import { managedAsset } from "@/db/files-schema";
import { mailOutbox, platformEvent } from "@/db/events-schema";
import { dispatchMailOutbox, queueDirectEmail } from "@/lib/mail-outbox";

const ids = Object.fromEntries(["dev", "buyer", "buyerProfile", "project", "villa"].map(name => [name, randomUUID()]));
const email = `outbox-${ids.buyer}@example.test`;
const createdRows: string[] = [];
const createdAt = new Date("1999-01-01T00:00:00Z");
const expiredLease = new Date(Date.now() - 10 * 60_000);
async function queued(extra: Partial<typeof mailOutbox.$inferInsert> = {}) {
  const id = randomUUID(); createdRows.push(id);
  const [row] = await db.insert(mailOutbox).values({ id, recipient: email, subject: "Synthetic outbox test", body: "Only a synthetic fixture", sourceType: "invitation", sourceId: randomUUID(), idempotencyKey: `outbox-test:${id}`, createdAt, nextAttemptAt: createdAt, ...extra }).returning();
  return row;
}
async function stored(id: string) { return (await db.select().from(mailOutbox).where(eq(mailOutbox.id, id)))[0]; }
const providerCalls = (key: string) => mocks.sendEmail.mock.calls.filter(([input]) => input.idempotencyKey === key);
async function fileEvent(visibility = "shared", archivedAt: Date | null = null) {
  const [asset] = await db.insert(managedAsset).values({ projectId: ids.project, villaId: ids.villa, kind: "doc", label: "Synthetic document", createdBy: ids.dev, visibility, archivedAt, activeVersion: 1 }).returning();
  const [event] = await db.insert(platformEvent).values({ actorId: ids.dev, actorLabel: "Fixture developer", projectId: ids.project, villaId: ids.villa, action: "file.share", targetId: asset.id, summary: "Synthetic shared file" }).returning();
  return { asset, event };
}
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || !url.pathname.includes("vdt_completion_test")) throw new Error("Outbox integration tests require the isolated local PostgreSQL fixture.");
  await db.insert(account).values([{ id: ids.dev, email: `outbox-${ids.dev}@example.test`, role: "developer" }, { id: ids.buyer, email, role: "buyer" }]);
  await db.insert(project).values({ id: ids.project, name: "Outbox fixture", slug: `outbox-${ids.project}` });
  await db.insert(villa).values({ id: ids.villa, projectId: ids.project, code: `O-${ids.villa.slice(0, 12)}` });
  await db.insert(buyer).values({ id: ids.buyerProfile, accountId: ids.buyer, name: "Outbox Buyer" });
  await db.insert(buyerVilla).values({ buyerId: ids.buyerProfile, villaId: ids.villa });
});
beforeEach(() => { vi.clearAllMocks(); mocks.sendEmail.mockResolvedValue(undefined); });
afterEach(async () => {
  // Retain test evidence but do not leave this test's pending leases in the
  // shared fixture queue. Never reset any other test's rows or counters.
  if (createdRows.length) await db.update(mailOutbox).set({ status: "cancelled", leaseId: null }).where(and(inArray(mailOutbox.id, [...createdRows]), inArray(mailOutbox.status, ["pending", "processing"])));
});

describe("transactional outbox on actual PostgreSQL", () => {
  it("claims overlapping dispatcher batches once per queued idempotency key", async () => {
    const rows = await Promise.all(Array.from({ length: 4 }, () => queued()));
    mocks.sendEmail.mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 35)); });
    await Promise.all(rows.map(() => dispatchMailOutbox(1)));
    for (const row of rows) {
      expect(providerCalls(row.idempotencyKey)).toHaveLength(1);
      const result = await stored(row.id); expect(result.status).toBe("sent"); expect(result.attempts).toBe(1); expect(result.leaseId).toBeNull(); expect(result.sentAt).not.toBeNull();
    }
  });
  it("keeps a failed attempt pending and retries the same row with the same provider key", async () => {
    const row = await queued(); let first = true;
    mocks.sendEmail.mockImplementation(async input => { if (input.idempotencyKey === row.idempotencyKey && first) { first = false; throw new Error("mail_provider_503"); } });
    await dispatchMailOutbox(1);
    const failedAttempt = await stored(row.id); expect(failedAttempt.status).toBe("pending"); expect(failedAttempt.attempts).toBe(1); expect(failedAttempt.lastError).toBe("mail_provider_503"); expect(failedAttempt.nextAttemptAt.getTime()).toBeGreaterThan(Date.now()); expect(failedAttempt.sentAt).toBeNull();
    await db.update(mailOutbox).set({ nextAttemptAt: createdAt }).where(eq(mailOutbox.id, row.id));
    await dispatchMailOutbox(1);
    const retried = await stored(row.id); expect(retried.status).toBe("sent"); expect(retried.attempts).toBe(2); expect(retried.lastError).toBeNull();
    expect(providerCalls(row.idempotencyKey)).toHaveLength(2);
    expect(providerCalls(row.idempotencyKey).map(([input]) => input.idempotencyKey)).toEqual([row.idempotencyKey, row.idempotencyKey]);
  });
  it("recovers a crashed expired lease with a fresh claim", async () => {
    const previousLease = randomUUID(); const row = await queued({ status: "processing", leaseId: previousLease, lockedAt: expiredLease, attempts: 2 });
    await dispatchMailOutbox(1);
    const result = await stored(row.id); expect(result.status).toBe("sent"); expect(result.attempts).toBe(3); expect(result.leaseId).toBeNull(); expect(providerCalls(row.idempotencyKey)).toHaveLength(1);
  });
  it("marks a crashed final attempt failed instead of stranding it as processing", async () => {
    const row = await queued({ status: "processing", leaseId: randomUUID(), lockedAt: expiredLease, attempts: 8 });
    await dispatchMailOutbox(0);
    const result = await stored(row.id); expect(result.status).toBe("failed"); expect(result.attempts).toBe(8); expect(result.lastError).toBe("delivery_unconfirmed"); expect(result.leaseId).toBeNull(); expect(providerCalls(row.idempotencyKey)).toHaveLength(0);
  });
  it("does not let a stale sender finalize a row whose lease was replaced", async () => {
    const row = await queued(); let release!: () => void; let entered!: () => void;
    const enteredProvider = new Promise<void>(resolve => { entered = resolve; });
    const finishProvider = new Promise<void>(resolve => { release = resolve; });
    mocks.sendEmail.mockImplementation(async input => { if (input.idempotencyKey === row.idempotencyKey) { entered(); await finishProvider; } });
    const running = dispatchMailOutbox(1); await enteredProvider;
    const replacementLease = randomUUID();
    await db.update(mailOutbox).set({ leaseId: replacementLease, status: "processing", attempts: 2, lockedAt: new Date() }).where(eq(mailOutbox.id, row.id));
    release(); await running;
    const result = await stored(row.id); expect(result.status).toBe("processing"); expect(result.leaseId).toBe(replacementLease); expect(result.sentAt).toBeNull();
  });
  it("cancels mail when the buyer-villa assignment was removed after publication", async () => {
    const { event } = await fileEvent(); const row = await queued({ eventId: event.id, recipientAccountId: ids.buyer, sourceType: "event", sourceId: event.id });
    await db.delete(buyerVilla).where(and(eq(buyerVilla.buyerId, ids.buyerProfile), eq(buyerVilla.villaId, ids.villa)));
    try {
      await dispatchMailOutbox(1); expect((await stored(row.id)).status).toBe("cancelled"); expect(providerCalls(row.idempotencyKey)).toHaveLength(0);
    } finally { await db.insert(buyerVilla).values({ buyerId: ids.buyerProfile, villaId: ids.villa }); }
  });
  it.each(["hidden", "archived", "replaced"])("suppresses a file-share message when the file is %s before delivery", async state => {
    const { asset, event } = await fileEvent(); const row = await queued({ eventId: event.id, recipientAccountId: ids.buyer, sourceType: "event", sourceId: event.id });
    await db.update(managedAsset).set(state === "archived" ? { archivedAt: new Date() } : state === "replaced" ? { visibility: "internal", activeVersion: 2 } : { visibility: "internal" }).where(eq(managedAsset.id, asset.id));
    await dispatchMailOutbox(1); expect((await stored(row.id)).status).toBe("cancelled"); expect(providerCalls(row.idempotencyKey)).toHaveLength(0);
  });
  it("cancels direct invitations for recipients with no current account", async () => {
    const row = await queued({ recipient: `nonexistent-${randomUUID()}@example.test` });
    await dispatchMailOutbox(1); expect((await stored(row.id)).status).toBe("cancelled"); expect(providerCalls(row.idempotencyKey)).toHaveLength(0);
  });
  it("deduplicates concurrent queue insertion with a durable unique key", async () => {
    const sourceId = randomUUID(); const idempotencyKey = `queue-race:${randomUUID()}`;
    const input = { idempotencyKey, recipient: email, subject: "Synthetic race", text: "Same message", sourceType: "invitation", sourceId };
    const ids = await Promise.all([db.transaction(tx => queueDirectEmail(tx, input)), db.transaction(tx => queueDirectEmail(tx, input))]);
    createdRows.push(...new Set(ids)); expect(new Set(ids).size).toBe(1);
    const rows = await db.select().from(mailOutbox).where(eq(mailOutbox.idempotencyKey, idempotencyKey)); expect(rows).toHaveLength(1);
  });
});
