import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../src/db/client";
import { account, auditLog, buyer, buyerVilla, paymentMilestone, project, projectManager, pmProject, villa } from "../../src/db/schema";
import { accountInvitation, managementRequest } from "../../src/db/management-schema";
import { billingDocument, billingInvoice, billingPayment } from "../../src/db/billing-schema";
import { mailOutbox, platformEvent } from "../../src/db/events-schema";
import { inviteAccount, managedVilla, saveVilla } from "../../src/lib/management/service";
import type { BillingSnapshot } from "../../src/lib/billing/domain";

// Dedicated synthetic rows only. Never truncate a shared database or call a
// real email provider; these tests exercise PostgreSQL transactions directly.
const marker = randomUUID().slice(0, 8);
const actor = { id: randomUUID(), role: "developer" };
const projectId = randomUUID();
const secondProjectId = randomUUID();
const villaId = randomUUID();
const otherVillaId = randomUUID();
const emails = ["concurrent", "coowner-a", "coowner-b", "pm", "bad"].map((name) => `${name}-${marker}@management.test`);
let isolatedDatabaseVerified = false;

beforeAll(async () => {
  const connection = new URL(process.env.DATABASE_URL ?? "postgres://invalid");
  if (process.env.VDT_LOCAL_TEST !== "1" || !["127.0.0.1", "localhost"].includes(connection.hostname) || connection.port !== "55439") throw new Error("Management integration tests require the isolated local test database on port 55439.");
  isolatedDatabaseVerified = true;
  await db.insert(account).values({ id: actor.id, email: `developer-${marker}@management.test`, role: "developer", displayName: "Synthetic developer" });
  await db.insert(project).values([{ id: projectId, name: "Management fixture", slug: `management-${marker}` }, { id: secondProjectId, name: "Other fixture", slug: `management-other-${marker}` }]);
  await db.insert(villa).values([{ id: villaId, projectId, code: `MG-${marker}-A`, priceTotalUsd: "155000.00", status: "planned" }, { id: otherVillaId, projectId, code: `MG-${marker}-B`, status: "planned" }]);
});

afterAll(async () => {
  if (!isolatedDatabaseVerified) return;
  // Delete only IDs belonging to this test run, in FK order.
  const users = await db.select({ id: account.id }).from(account).where(inArray(account.email, emails));
  const ids = users.map((row) => row.id);
  await db.transaction(async (tx) => {
    const invites = ids.length ? await tx.select({ id: accountInvitation.id }).from(accountInvitation).where(inArray(accountInvitation.accountId, ids)) : [];
    if (invites.length) await tx.delete(mailOutbox).where(and(eq(mailOutbox.sourceType, "invitation"), inArray(mailOutbox.sourceId, invites.map((row) => row.id))));
    await tx.delete(platformEvent).where(eq(platformEvent.actorId, actor.id));
    await tx.delete(auditLog).where(eq(auditLog.actorAccountId, actor.id));
    await tx.delete(managementRequest).where(eq(managementRequest.actorId, actor.id));
    const fixtureVillas = await tx.select({ id: villa.id }).from(villa).where(inArray(villa.projectId, [projectId, secondProjectId]));
    if (fixtureVillas.length) {
      const fixtureVillaIds = fixtureVillas.map((row) => row.id);
      const invoices = await tx.select({ id: billingInvoice.id }).from(billingInvoice).where(inArray(billingInvoice.villaId, fixtureVillaIds));
      await tx.delete(billingDocument).where(inArray(billingDocument.villaId, fixtureVillaIds));
      if (invoices.length) await tx.delete(billingPayment).where(inArray(billingPayment.invoiceId, invoices.map((row) => row.id)));
      await tx.delete(billingInvoice).where(inArray(billingInvoice.villaId, fixtureVillaIds));
      await tx.delete(paymentMilestone).where(inArray(paymentMilestone.villaId, fixtureVillaIds));
    }
    if (ids.length) {
      await tx.delete(accountInvitation).where(inArray(accountInvitation.accountId, ids));
      const buyers = await tx.select({ id: buyer.id }).from(buyer).where(inArray(buyer.accountId, ids));
      if (buyers.length) await tx.delete(buyerVilla).where(inArray(buyerVilla.buyerId, buyers.map((row) => row.id)));
      const managers = await tx.select({ id: projectManager.id }).from(projectManager).where(inArray(projectManager.accountId, ids));
      if (managers.length) await tx.delete(pmProject).where(inArray(pmProject.pmId, managers.map((row) => row.id)));
      await tx.delete(buyer).where(inArray(buyer.accountId, ids));
      await tx.delete(projectManager).where(inArray(projectManager.accountId, ids));
      await tx.delete(account).where(inArray(account.id, ids));
    }
    await tx.delete(villa).where(inArray(villa.projectId, [projectId, secondProjectId]));
    await tx.delete(project).where(inArray(project.id, [projectId, secondProjectId]));
    await tx.delete(account).where(eq(account.id, actor.id));
  });
});

describe("management PostgreSQL integration", () => {
  it("concurrent identical retries provision exactly one account, ownership, invite and outbox email", async () => {
    const input = { requestId: randomUUID(), email: emails[0], role: "buyer", name: "Concurrent owner", villaIds: [villaId] };
    const results = await Promise.all([inviteAccount(actor, input), inviteAccount(actor, input), inviteAccount(actor, input)]);
    expect(new Set(results.map((row) => row.accountId)).size).toBe(1);
    const users = await db.select().from(account).where(eq(account.email, input.email));
    expect(users).toHaveLength(1); expect(users[0].role).toBe("buyer");
    expect(users[0].displayName).toBe("Concurrent owner");
    const profiles = await db.select().from(buyer).where(eq(buyer.accountId, users[0].id));
    expect(profiles).toHaveLength(1);
    expect(await db.select().from(buyerVilla).where(and(eq(buyerVilla.buyerId, profiles[0].id), eq(buyerVilla.villaId, villaId)))).toHaveLength(1);
    const invitations = await db.select().from(accountInvitation).where(eq(accountInvitation.accountId, users[0].id));
    expect(invitations).toHaveLength(1); expect(invitations[0].deliveryCount).toBe(1);
    const mail = await db.select().from(mailOutbox).where(and(eq(mailOutbox.sourceType, "invitation"), eq(mailOutbox.sourceId, invitations[0].id)));
    expect(mail).toHaveLength(1); expect(mail[0].status).toBe("pending"); expect(mail[0].body).toContain("/login");
    expect(await db.select().from(managementRequest).where(eq(managementRequest.id, input.requestId))).toHaveLength(1);
  });

  it("concurrent fresh request IDs cannot bypass resend cooldown", async () => {
    const results = await Promise.allSettled([1, 2].map(() => inviteAccount(actor, { requestId: randomUUID(), email: emails[0], role: "buyer", name: "Concurrent owner", villaIds: [villaId] })));
    expect(results.every((result) => result.status === "rejected" && result.reason.status === 429)).toBe(true);
    const [user] = await db.select().from(account).where(eq(account.email, emails[0]));
    const [invitation] = await db.select().from(accountInvitation).where(eq(accountInvitation.accountId, user.id));
    expect(invitation.deliveryCount).toBe(1);
    expect(await db.select().from(mailOutbox).where(and(eq(mailOutbox.sourceType, "invitation"), eq(mailOutbox.sourceId, invitation.id)))).toHaveLength(1);
  });

  it("competing owner invitations cannot silently grant co-ownership or leave an orphan account", async () => {
    const results = await Promise.allSettled(emails.slice(1, 3).map((email) => inviteAccount(actor, { requestId: randomUUID(), email, role: "buyer", name: "Prospective owner", villaIds: [otherVillaId] })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected" && result.reason.status === 409)).toHaveLength(1);
    expect(await db.select().from(account).where(inArray(account.email, emails.slice(1, 3)))).toHaveLength(1);
    expect(await db.select().from(buyerVilla).where(eq(buyerVilla.villaId, otherVillaId))).toHaveLength(1);
  });

  it("same-role PM provisioning creates explicit project access and never elevates an owner", async () => {
    const result = await inviteAccount(actor, { requestId: randomUUID(), email: emails[3], role: "pm", name: "Fixture manager", projectIds: [projectId], villaIds: [] });
    const [manager] = await db.select().from(projectManager).where(eq(projectManager.accountId, result.accountId));
    expect(await db.select().from(pmProject).where(eq(pmProject.pmId, manager.id))).toMatchObject([{ projectId }]);
    await expect(inviteAccount(actor, { requestId: randomUUID(), email: emails[0], role: "pm", name: "Wrong role", projectIds: [secondProjectId], villaIds: [] })).rejects.toMatchObject({ status: 409 });
    const [owner] = await db.select().from(account).where(eq(account.email, emails[0]));
    expect(owner.role).toBe("buyer");
    expect(await db.select().from(projectManager).where(eq(projectManager.accountId, owner.id))).toHaveLength(0);
  });

  it("two stale villa editors cannot overwrite each other", async () => {
    const [row] = await db.select().from(villa).where(eq(villa.id, villaId));
    const { revision, ...fields } = managedVilla(row);
    const results = await Promise.allSettled(["New package A", "New package B"].map((pricePackage) => saveVilla(actor, { ...fields, expectedRevision: revision, requestId: randomUUID(), pricePackage })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected" && result.reason.status === 409)).toHaveLength(1);
    const [saved] = await db.select().from(villa).where(eq(villa.id, villaId));
    expect(saved.priceTotalUsd).toBe("155000.00");
    expect(await db.select().from(buyerVilla).where(eq(buyerVilla.villaId, villaId))).toHaveLength(1);
  });

  it("invalid assignment rolls back completely before any invitation becomes deliverable", async () => {
    await expect(inviteAccount(actor, { requestId: randomUUID(), email: emails[4], role: "buyer", name: "No access", villaIds: [randomUUID()] })).rejects.toMatchObject({ status: 409 });
    expect(await db.select().from(account).where(eq(account.email, emails[4]))).toHaveLength(0);
    expect(await db.select().from(mailOutbox).where(eq(mailOutbox.recipient, emails[4]))).toHaveLength(0);
  });

  it("refreshes a same-role invited account's validated display name without changing its role", async () => {
    const [manager] = await db.select().from(account).where(eq(account.email, emails[3]));
    await db.update(account).set({ displayName: null }).where(eq(account.id, manager.id));
    await db.update(accountInvitation).set({ lastRequestedAt: new Date(Date.now() - 16 * 60_000) }).where(eq(accountInvitation.accountId, manager.id));
    await inviteAccount(actor, { requestId: randomUUID(), email: emails[3], role: "pm", name: "  Actual manager name  ", projectIds: [projectId], villaIds: [] });
    const [updated] = await db.select().from(account).where(eq(account.id, manager.id));
    expect(updated.displayName).toBe("Actual manager name");
    expect(updated.role).toBe("pm");
  });

  it("preserves the contract total and immutable invoice/document snapshots after invoicing", async () => {
    const [residence] = await db.insert(villa).values({ projectId, code: `MG-${marker}-INV`, priceTotalUsd: "155000.00", status: "planned" }).returning();
    const [step] = await db.insert(paymentMilestone).values({ villaId: residence.id, percent: "10.00", dueLabel: "Deposit", amountUsd: "15500.00", status: "open", expectedAt: new Date("2027-01-01") }).returning();
    const snapshot: BillingSnapshot = {
      version: 1, documentKind: "invoice", number: `FIXTURE-${marker}`, issuedAt: new Date().toISOString(), dueAt: new Date("2027-01-01").toISOString(),
      issuer: { companyName: "Fixture issuer", address: "Synthetic address", email: "issuer@management.test", registrationNumber: "FIXTURE", taxNumber: "", bankInstructions: "Synthetic payment instructions", invoicePrefix: "INV" },
      recipient: { name: "Fixture owner", address: "Synthetic owner address", email: emails[0] },
      projectName: "Management fixture", villaCode: residence.code, description: "Deposit", percent: "10.00", amountCents: 1550000, currency: "USD",
    };
    const [invoice] = await db.insert(billingInvoice).values({ projectId, villaId: residence.id, milestoneId: step.id, number: snapshot.number, amountCents: snapshot.amountCents, issuedBy: actor.id, dueAt: new Date(snapshot.dueAt), snapshot }).returning();
    await db.insert(billingDocument).values({ invoiceId: invoice.id, villaId: residence.id, kind: "invoice", number: snapshot.number, snapshot });
    const { revision, ...fields } = managedVilla(residence);
    await expect(saveVilla(actor, { ...fields, requestId: randomUUID(), expectedRevision: revision, priceTotalUsd: "160000.00" })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("issued invoices") });
    const [unchanged] = await db.select().from(villa).where(eq(villa.id, residence.id));
    expect(unchanged.priceTotalUsd).toBe("155000.00");
    expect((await db.select().from(billingInvoice).where(eq(billingInvoice.id, invoice.id)))[0].snapshot).toEqual(snapshot);
    expect((await db.select().from(billingDocument).where(eq(billingDocument.invoiceId, invoice.id)))[0].snapshot).toEqual(snapshot);
    expect((await db.select().from(paymentMilestone).where(eq(paymentMilestone.id, step.id)))[0].amountUsd).toBe("15500.00");
    // Numerically identical price formatting must not prevent other edits.
    const edited = await saveVilla(actor, { ...fields, requestId: randomUUID(), expectedRevision: revision, priceTotalUsd: "155000", typeLabel: "Updated residence description" });
    expect(edited.villa.priceTotalUsd).toBe("155000.00");
    expect(edited.villa.typeLabel).toBe("Updated residence description");
  });

  it("refuses changing or clearing a total after a historical paid milestone, including paidAt-only legacy rows", async () => {
    for (const historical of [{ status: "paid", paidAt: null }, { status: "open", paidAt: new Date("2026-10-01") }]) {
      const [residence] = await db.insert(villa).values({ projectId, code: `MG-${marker}-${historical.status === "paid" ? "PAID" : "DATE"}`, priceTotalUsd: "155000.00", status: "planned" }).returning();
      const [step] = await db.insert(paymentMilestone).values({ villaId: residence.id, percent: "10.00", dueLabel: "Historical deposit", amountUsd: "15500.00", ...historical }).returning();
      const { revision, ...fields } = managedVilla(residence);
      for (const priceTotalUsd of ["160000.00", null]) {
        await expect(saveVilla(actor, { ...fields, requestId: randomUUID(), expectedRevision: revision, priceTotalUsd })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("recorded payments") });
      }
      expect((await db.select().from(villa).where(eq(villa.id, residence.id)))[0].priceTotalUsd).toBe("155000.00");
      expect((await db.select().from(paymentMilestone).where(eq(paymentMilestone.id, step.id)))[0]).toMatchObject({ amountUsd: "15500.00", ...historical });
    }
  });

  it("requires an explicit schedule reset instead of silently diverging unissued milestone amounts", async () => {
    const [residence] = await db.insert(villa).values({ projectId, code: `MG-${marker}-OPEN`, priceTotalUsd: "155000.00", status: "planned" }).returning();
    await db.insert(paymentMilestone).values([
      { villaId: residence.id, percent: "10.00", dueLabel: "Deposit", amountUsd: "15500.00", status: "open", sequence: 0 },
      { villaId: residence.id, percent: "90.00", dueLabel: "Handover", amountUsd: "139500.00", status: "open", sequence: 1 },
    ]);
    const { revision, ...fields } = managedVilla(residence);
    await expect(saveVilla(actor, { ...fields, requestId: randomUUID(), expectedRevision: revision, priceTotalUsd: "160000.00" })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("explicitly reset") });
    expect((await db.select().from(villa).where(eq(villa.id, residence.id)))[0].priceTotalUsd).toBe("155000.00");
    const steps = await db.select().from(paymentMilestone).where(eq(paymentMilestone.villaId, residence.id)).orderBy(paymentMilestone.sequence);
    expect(steps.map((step) => step.amountUsd)).toEqual(["15500.00", "139500.00"]);
  });

  it("still permits a contract-total correction before any payment schedule exists", async () => {
    const [residence] = await db.insert(villa).values({ projectId, code: `MG-${marker}-NEW`, priceTotalUsd: "155000.00", status: "planned" }).returning();
    const { revision, ...fields } = managedVilla(residence);
    const saved = await saveVilla(actor, { ...fields, requestId: randomUUID(), expectedRevision: revision, priceTotalUsd: "160000.00" });
    expect(saved.villa.priceTotalUsd).toBe("160000.00");
  });
});
