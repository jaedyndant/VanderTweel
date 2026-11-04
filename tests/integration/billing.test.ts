import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const identity = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: identity.id } })) }));
import { db } from "@/db/client";
import { account, buyer, buyerVilla, paymentMilestone, project, villa } from "@/db/schema";
import { billingDocument, billingInvoice, billingIssuer, billingPayment } from "@/db/billing-schema";
import { mailOutbox, platformEvent } from "@/db/events-schema";
import { applyBillingTemplate, getAuthorizedBillingDocument, getBillingDashboard, getBillingDocumentsForBuyer, issueBillingInvoice, recordBillingPayment, reverseBillingPayment, saveBillingIssuer, saveBillingRecipient, saveBillingTemplate } from "@/lib/billing/service";
import { renderBillingPdf } from "@/lib/billing/pdf";

let projectId: string, villaId: string, developerId: string, ownerId: string, outsiderId: string, pmId: string;
const issuer = { companyName: "Billing QA — Société", address: "Synthetic billing address\nTest City", email: "billing@example.test", bankInstructions: "TEST FIXTURE — no real bank account", invoicePrefix: "QA" };
const recipient = { name: "Buyer QA — 李明", address: "Synthetic recipient address", email: "buyer@example.test" };
const paidDate = new Date().toISOString().slice(0, 10);

beforeAll(() => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (process.env.VDT_LOCAL_TEST !== "1" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.includes("test")) throw new Error("Billing integration tests require the isolated local test database.");
});
beforeEach(async () => {
  projectId = randomUUID(); villaId = randomUUID(); developerId = randomUUID(); ownerId = randomUUID(); outsiderId = randomUUID(); pmId = randomUUID();
  identity.id = developerId;
  await db.insert(account).values([
    { id: developerId, email: `${developerId}@example.test`, role: "developer", displayName: "QA Developer" },
    { id: ownerId, email: `${ownerId}@example.test`, role: "buyer", displayName: "QA Owner" },
    { id: outsiderId, email: `${outsiderId}@example.test`, role: "buyer", displayName: "QA Other Owner" },
    { id: pmId, email: `${pmId}@example.test`, role: "pm", displayName: "QA PM" },
  ]);
  await db.insert(project).values({ id: projectId, name: "Billing integration fixture", slug: `billing-qa-${projectId}` });
  await db.insert(villa).values({ id: villaId, projectId, code: `QA-${villaId.slice(0, 12)}`, priceTotalUsd: "100.01" });
  const [owner] = await db.insert(buyer).values({ accountId: ownerId, name: "QA Owner" }).returning();
  await db.insert(buyer).values({ accountId: outsiderId, name: "QA Other Owner" });
  await db.insert(buyerVilla).values({ buyerId: owner.id, villaId });
  await saveBillingTemplate(projectId, { name: "QA exact cents", steps: [{ label: "First", percent: "33.33", dueDays: 0 }, { label: "Final", percent: "66.67", dueDays: 30 }] });
  await applyBillingTemplate(projectId, villaId, paidDate, false);
});
async function configure() { await saveBillingIssuer(projectId, issuer); await saveBillingRecipient(projectId, villaId, recipient); }
async function firstStep() { const rows = await db.select().from(paymentMilestone).where(eq(paymentMilestone.villaId, villaId)).orderBy(paymentMilestone.sequence); return rows[0]; }

describe("billing — real PostgreSQL transactions", () => {
  it("allocates all contract cents, rejects incomplete totals, and refuses silent schedule replacement", async () => {
    const rows = await db.select().from(paymentMilestone).where(eq(paymentMilestone.villaId, villaId)).orderBy(paymentMilestone.sequence);
    expect(rows.map((row) => row.amountUsd)).toEqual(["33.33", "66.68"]);
    await expect(saveBillingTemplate(projectId, { name: "Bad", steps: [{ label: "Only", percent: "99.99", dueDays: 0 }] })).rejects.toThrow(/100%/);
    await expect(applyBillingTemplate(projectId, villaId, paidDate, false)).rejects.toThrow(/Confirm replacement/);
    expect((await db.select().from(paymentMilestone).where(eq(paymentMilestone.villaId, villaId))).map((row) => row.id).sort()).toEqual(rows.map((row) => row.id).sort());
  });
  it("blocks issue without verified issuer and recipient setup, without orphan documents", async () => {
    const step = await firstStep();
    await expect(issueBillingInvoice(projectId, villaId, step.id)).rejects.toThrow(/company/);
    expect(await db.select().from(billingInvoice).where(eq(billingInvoice.villaId, villaId))).toHaveLength(0);
    expect(await db.select().from(billingDocument).where(eq(billingDocument.villaId, villaId))).toHaveLength(0);
  });
  it("rolls back a partially executed issue when a later database write fails", async () => {
    await configure(); const step = await firstStep();
    // Exhaust only this synthetic project's counter. The invoice INSERT runs
    // before the PostgreSQL integer-overflow failure in the counter UPDATE.
    await db.update(billingIssuer).set({ nextNumber: 2_147_483_647 }).where(eq(billingIssuer.projectId, projectId));
    await expect(issueBillingInvoice(projectId, villaId, step.id)).rejects.toThrow();
    expect(await db.select().from(billingInvoice).where(eq(billingInvoice.villaId, villaId))).toHaveLength(0);
    expect(await db.select().from(billingDocument).where(eq(billingDocument.villaId, villaId))).toHaveLength(0);
    expect(await db.select().from(platformEvent).where(and(eq(platformEvent.projectId, projectId), eq(platformEvent.action, "billing.invoice_issued")))).toHaveLength(0);
  });
  it("preserves paid legacy records without fabricating historical invoice or receipt", async () => {
    await configure(); const step = await firstStep();
    await db.update(paymentMilestone).set({ status: "paid", paidAt: new Date() }).where(eq(paymentMilestone.id, step.id));
    const dashboard = await getBillingDashboard(projectId, villaId);
    expect(dashboard.milestones[0].billingStatus).toBe("paid"); expect(dashboard.milestones[0].invoice).toBeNull();
    await expect(issueBillingInvoice(projectId, villaId, step.id)).rejects.toThrow(/Historical/);
    await expect(applyBillingTemplate(projectId, villaId, paidDate, true)).rejects.toThrow(/cannot be replaced/);
    expect(await db.select().from(billingDocument).where(eq(billingDocument.villaId, villaId))).toHaveLength(0);
  });
  it("concurrent issue creates one immutable invoice, one document, one event and one buyer delivery", async () => {
    await configure(); const step = await firstStep();
    const results = await Promise.all(Array.from({ length: 8 }, () => issueBillingInvoice(projectId, villaId, step.id)));
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(results.filter((result) => !result.existing)).toHaveLength(1);
    const invoices = await db.select().from(billingInvoice).where(eq(billingInvoice.villaId, villaId));
    expect(invoices).toHaveLength(1); expect(invoices[0].amountCents).toBe(3333);
    expect(await db.select().from(billingDocument).where(eq(billingDocument.villaId, villaId))).toHaveLength(1);
    const events = await db.select().from(platformEvent).where(and(eq(platformEvent.projectId, projectId), eq(platformEvent.action, "billing.invoice_issued")));
    expect(events).toHaveLength(1);
    const deliveries = await db.select().from(mailOutbox).where(eq(mailOutbox.eventId, events[0].id));
    expect(deliveries).toHaveLength(1); expect(deliveries[0].recipientAccountId).toBe(ownerId); expect(deliveries[0].body).toContain(`/koper/documenten?villa=${villaId}`);
    const [config] = await db.select().from(billingIssuer).where(eq(billingIssuer.projectId, projectId)); expect(config.nextNumber).toBe(2);
    await saveBillingIssuer(projectId, { ...issuer, companyName: "Changed future issuer", bankInstructions: "Changed future bank" });
    await saveBillingRecipient(projectId, villaId, { ...recipient, name: "Changed future recipient" });
    const [unchanged] = await db.select().from(billingInvoice).where(eq(billingInvoice.id, invoices[0].id));
    expect(unchanged.snapshot).toEqual(invoices[0].snapshot);
    await expect(applyBillingTemplate(projectId, villaId, paidDate, true)).rejects.toThrow(/cannot be replaced/);
  });
  it("concurrent settlement creates one receipt and payment; correction retains and marks history", async () => {
    await configure(); const step = await firstStep(); await issueBillingInvoice(projectId, villaId, step.id);
    const paymentInput = { amount: step.amountUsd!, reference: "QA-TRANSFER-001", paidDate, requestId: randomUUID() };
    const results = await Promise.all(Array.from({ length: 6 }, () => recordBillingPayment(projectId, villaId, step.id, paymentInput)));
    expect(new Set(results.map((result) => result.id)).size).toBe(1); expect(results.filter((result) => !result.existing)).toHaveLength(1);
    const documents = await db.select().from(billingDocument).where(eq(billingDocument.villaId, villaId)); expect(documents).toHaveLength(2);
    const receipt = documents.find((document) => document.kind === "receipt")!;
    expect(receipt.snapshot.payment?.reference).toBe("QA-TRANSFER-001");
    expect((await firstStep()).status).toBe("paid");
    await expect(recordBillingPayment(projectId, villaId, step.id, { ...paymentInput, reference: "DIFFERENT" })).rejects.toThrow(/already/);
    await reverseBillingPayment(projectId, villaId, results[0].id, "QA correction — original bank reference was incorrect.");
    expect((await firstStep()).status).toBe("open");
    await expect(recordBillingPayment(projectId, villaId, step.id, paymentInput)).rejects.toThrow(/reversed/);
    expect((await firstStep()).status).toBe("open");
    const [original] = await db.select().from(billingDocument).where(eq(billingDocument.id, receipt.id)); expect(original.snapshot).toEqual(receipt.snapshot);
    const ownerDocuments = await getBillingDocumentsForBuyer(ownerId, villaId); expect(ownerDocuments.find((doc) => doc.id === receipt.id)?.label).toContain("reversed");
    await recordBillingPayment(projectId, villaId, step.id, { ...paymentInput, requestId: randomUUID(), reference: "QA-TRANSFER-CORRECTED" });
    expect((await firstStep()).status).toBe("paid");
    expect(await db.select().from(billingDocument).where(eq(billingDocument.villaId, villaId))).toHaveLength(3);
    const [invoice] = await db.select().from(billingInvoice).where(eq(billingInvoice.villaId, villaId));
    const payments = await db.select().from(billingPayment).where(eq(billingPayment.invoiceId, invoice.id)); expect(payments).toHaveLength(2); expect(payments.filter((payment) => !payment.reversedAt)).toHaveLength(1);
  });
  it("rejects partial, overpaid and future transfers without marking the step paid", async () => {
    await configure(); const step = await firstStep(); await issueBillingInvoice(projectId, villaId, step.id);
    for (const amount of ["0.01", "33.34"]) await expect(recordBillingPayment(projectId, villaId, step.id, { amount, reference: "QA", paidDate })).rejects.toThrow(/exact invoiced/);
    await expect(recordBillingPayment(projectId, villaId, step.id, { amount: "33.33", reference: "QA", paidDate: "2099-01-01" })).rejects.toThrow(/future/);
    expect((await firstStep()).status).toBe("open");
    expect(await db.select().from(billingDocument).where(eq(billingDocument.villaId, villaId))).toHaveLength(1);
  });
  it("enforces developer mutation roles and direct document ownership independently of UI", async () => {
    await configure(); const step = await firstStep(); await issueBillingInvoice(projectId, villaId, step.id);
    const [document] = await db.select().from(billingDocument).where(eq(billingDocument.villaId, villaId));
    identity.id = pmId;
    await expect(getBillingDashboard(projectId, villaId)).rejects.toThrow(/Access/);
    await expect(issueBillingInvoice(projectId, villaId, step.id)).rejects.toThrow(/Access/);
    expect(await getAuthorizedBillingDocument(document.id)).toBeNull();
    identity.id = outsiderId;
    expect(await getAuthorizedBillingDocument(document.id)).toBeNull(); expect(await getBillingDocumentsForBuyer(outsiderId, villaId)).toEqual([]);
    identity.id = ownerId;
    await expect(saveBillingIssuer(projectId, issuer)).rejects.toThrow(/Access/);
    expect((await getAuthorizedBillingDocument(document.id))?.document.id).toBe(document.id);
    expect(await getBillingDocumentsForBuyer(ownerId, villaId)).toHaveLength(1);
    identity.id = developerId;
    expect((await getAuthorizedBillingDocument(document.id))?.document.id).toBe(document.id);
  });
  it("renders a genuine downloadable PDF with Unicode recipient identity and long bank instructions", async () => {
    await configure(); const step = await firstStep(); await issueBillingInvoice(projectId, villaId, step.id);
    const [document] = await db.select().from(billingDocument).where(eq(billingDocument.villaId, villaId));
    const bytes = await renderBillingPdf({ ...document.snapshot, issuer: { ...document.snapshot.issuer, bankInstructions: Array.from({ length: 35 }, (_, index) => `Long instruction ${index}: ${issuer.bankInstructions}`).join("\n") } });
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes); expect(pdf.getPageCount()).toBeGreaterThan(1); expect(pdf.getTitle()).toContain(document.number);
  });
});
