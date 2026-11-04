import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, type PlatformTx } from "@/db/client";
import { account, buyer, buyerVilla, paymentMilestone, villa } from "@/db/schema";
import { billingDocument, billingInvoice, billingIssuer, billingPayment, billingRecipient, billingScheduleTemplate } from "@/db/billing-schema";
import { assertScope, requireActor } from "@/lib/platform-access";
import { writePlatformEvent } from "@/lib/platform-events";
import { allocateCents, centsToUsd, dateOnly, deriveBillingStatus, issuerInput, parseCents, recipientInput, scheduleInput, validateSchedule, type BillingSnapshot } from "./domain";

export class BillingError extends Error {}
function requireValue(value: unknown, message: string): asserts value { if (!value) throw new BillingError(message); }
type Actor = Awaited<ReturnType<typeof requireActor>>;
async function lockVilla(tx: PlatformTx, actor: Actor, projectId: string, villaId: string) {
  const scope = await assertScope(tx, actor, { projectId, villaId }, { developerOnly: true });
  const [row] = await tx.select().from(villa).where(and(eq(villa.id, villaId), eq(villa.projectId, projectId))).for("update");
  requireValue(row, "Residence not found.");
  return { row, project: scope.project };
}
async function event(tx: PlatformTx, actor: Actor, projectId: string, villaId: string | undefined, action: string, targetId: string, summary: string, notify = false, link = "/koper/betaalschema") {
  await writePlatformEvent(tx, { actorId: actor.id, projectId, villaId, action, targetId, summary, notify, pmSafe: false, link });
}

export async function saveBillingIssuer(projectId: string, input: unknown) {
  const actor = await requireActor(true);
  const parsed = issuerInput.parse(input);
  return db.transaction(async (tx) => {
    await assertScope(tx, actor, { projectId }, { developerOnly: true });
    await tx.insert(billingIssuer).values({ projectId, ...parsed }).onConflictDoUpdate({ target: billingIssuer.projectId, set: { ...parsed, updatedAt: new Date() } });
    await event(tx, actor, projectId, undefined, "billing.issuer_saved", projectId, "Invoice issuer and payment instructions updated. Issued documents are unchanged.");
  });
}
export async function saveBillingRecipient(projectId: string, villaId: string, input: unknown) {
  const actor = await requireActor(true);
  const parsed = recipientInput.parse(input);
  return db.transaction(async (tx) => {
    await lockVilla(tx, actor, projectId, villaId);
    await tx.insert(billingRecipient).values({ villaId, ...parsed }).onConflictDoUpdate({ target: billingRecipient.villaId, set: { ...parsed, updatedAt: new Date() } });
    await event(tx, actor, projectId, villaId, "billing.recipient_saved", villaId, "Billing recipient updated. Issued documents are unchanged.");
  });
}
export async function saveBillingTemplate(projectId: string, input: unknown) {
  const actor = await requireActor(true);
  const parsed = scheduleInput.parse(input);
  try { validateSchedule(parsed.steps); } catch (error) { throw new BillingError((error as Error).message); }
  return db.transaction(async (tx) => {
    await assertScope(tx, actor, { projectId }, { developerOnly: true });
    await tx.insert(billingScheduleTemplate).values({ projectId, ...parsed }).onConflictDoUpdate({ target: billingScheduleTemplate.projectId, set: { ...parsed, updatedAt: new Date() } });
    await event(tx, actor, projectId, undefined, "billing.template_saved", projectId, "Project payment schedule template updated. Existing schedules are unchanged.");
  });
}
export async function applyBillingTemplate(projectId: string, villaId: string, startDate: string, replaceUnissued: boolean) {
  const actor = await requireActor(true);
  let start: Date;
  try { start = dateOnly(startDate); } catch (error) { throw new BillingError((error as Error).message); }
  return db.transaction(async (tx) => {
    const { row } = await lockVilla(tx, actor, projectId, villaId);
    const [template] = await tx.select().from(billingScheduleTemplate).where(eq(billingScheduleTemplate.projectId, projectId));
    requireValue(template, "Save a project schedule template first.");
    requireValue(row.priceTotalUsd, "Set the residence contract total before applying a schedule.");
    const existing = await tx.select().from(paymentMilestone).where(eq(paymentMilestone.villaId, villaId));
    const invoices = await tx.select({ id: billingInvoice.id }).from(billingInvoice).where(eq(billingInvoice.villaId, villaId)).limit(1);
    requireValue(!invoices.length && !existing.some((item) => item.status === "paid" || item.paidAt), "A schedule with issued invoices or recorded payments cannot be replaced.");
    requireValue(!existing.length || replaceUnissued, "Confirm replacement of the existing unissued schedule.");
    let amounts: number[];
    try { amounts = allocateCents(parseCents(row.priceTotalUsd), template.steps); } catch (error) { throw new BillingError((error as Error).message); }
    if (existing.length) await tx.delete(paymentMilestone).where(eq(paymentMilestone.villaId, villaId));
    await tx.insert(paymentMilestone).values(template.steps.map((step, index) => ({ villaId, percent: step.percent, dueLabel: step.label, sequence: index, amountUsd: centsToUsd(amounts[index]), expectedAt: new Date(start.getTime() + step.dueDays * 86_400_000), status: "open" })));
    await event(tx, actor, projectId, villaId, "billing.schedule_applied", villaId, `${row.code}: payment schedule published.`, true);
  });
}

/** All issue/pay/reverse operations first lock the residence. This serializes
 * schedule replacement with issuance and each settlement, before unique DB
 * constraints provide the final independent idempotency guard. */
export async function issueBillingInvoice(projectId: string, villaId: string, milestoneId: string) {
  const actor = await requireActor(true);
  return db.transaction(async (tx) => {
    const { row, project: projectRow } = await lockVilla(tx, actor, projectId, villaId);
    const [milestone] = await tx.select().from(paymentMilestone).where(and(eq(paymentMilestone.id, milestoneId), eq(paymentMilestone.villaId, villaId))).for("update");
    requireValue(milestone, "Payment step not found for this residence.");
    const [existing] = await tx.select().from(billingInvoice).where(eq(billingInvoice.milestoneId, milestoneId));
    if (existing) return { id: existing.id, number: existing.number, existing: true };
    requireValue(milestone.status !== "paid", "Historical paid steps cannot be retrospectively invoiced here.");
    requireValue(milestone.amountUsd && milestone.expectedAt, "Complete the payment amount and due date before issuing.");
    const [issuer] = await tx.select().from(billingIssuer).where(eq(billingIssuer.projectId, projectId)).for("update");
    const [recipient] = await tx.select().from(billingRecipient).where(eq(billingRecipient.villaId, villaId));
    requireValue(issuer && recipient, "Save the actual company, bank instructions and recipient before issuing an invoice.");
    const [owner] = await tx.select({ id: buyer.id }).from(buyerVilla).innerJoin(buyer, eq(buyer.id, buyerVilla.buyerId)).where(eq(buyerVilla.villaId, villaId)).limit(1);
    requireValue(owner, "Assign a buyer before issuing an invoice.");
    let amountCents: number;
    try { amountCents = parseCents(milestone.amountUsd); } catch (error) { throw new BillingError((error as Error).message); }
    const now = new Date();
    const number = `${issuer.invoicePrefix}-${projectId.slice(0, 8).toUpperCase()}-${now.getUTCFullYear()}-${String(issuer.nextNumber).padStart(5, "0")}`;
    const snapshot: BillingSnapshot = {
      version: 1, documentKind: "invoice", number, issuedAt: now.toISOString(), dueAt: milestone.expectedAt.toISOString(),
      issuer: issuerInput.parse({ ...issuer, registrationNumber: issuer.registrationNumber ?? "", taxNumber: issuer.taxNumber ?? "" }),
      recipient: recipientInput.parse(recipient), projectName: projectRow.name, villaCode: row.code,
      description: milestone.dueLabel, percent: milestone.percent, amountCents, currency: "USD",
    };
    const [invoice] = await tx.insert(billingInvoice).values({ projectId, villaId, milestoneId, number, amountCents, issuedBy: actor.id, issuedAt: now, dueAt: milestone.expectedAt, snapshot }).returning();
    await tx.update(billingIssuer).set({ nextNumber: issuer.nextNumber + 1 }).where(eq(billingIssuer.projectId, projectId));
    await tx.insert(billingDocument).values({ invoiceId: invoice.id, villaId, kind: "invoice", number, snapshot });
    await event(tx, actor, projectId, villaId, "billing.invoice_issued", invoice.id, `${row.code}: invoice ${number} is available for ${milestone.dueLabel}.`, true, `/koper/documenten?villa=${villaId}`);
    return { id: invoice.id, number, existing: false };
  });
}

export async function recordBillingPayment(projectId: string, villaId: string, milestoneId: string, input: { amount: string; reference: string; paidDate: string; requestId?: string }) {
  const actor = await requireActor(true);
  let amountCents: number, paidAt: Date;
  try { amountCents = parseCents(input.amount); paidAt = dateOnly(input.paidDate); } catch (error) { throw new BillingError((error as Error).message); }
  const reference = input.reference.trim();
  requireValue(reference.length >= 2 && reference.length <= 200, "Enter the actual payment reference (2–200 characters).");
  requireValue(input.paidDate <= new Date().toISOString().slice(0, 10), "Payment date cannot be in the future.");
  return db.transaction(async (tx) => {
    const { row } = await lockVilla(tx, actor, projectId, villaId);
    const [milestone] = await tx.select().from(paymentMilestone).where(and(eq(paymentMilestone.id, milestoneId), eq(paymentMilestone.villaId, villaId))).for("update");
    requireValue(milestone, "Payment step not found.");
    const [invoice] = await tx.select().from(billingInvoice).where(eq(billingInvoice.milestoneId, milestoneId)).for("update");
    requireValue(invoice, "Issue the invoice before recording its payment. Historical entries are left unchanged.");
    requireValue(amountCents === invoice.amountCents, "Record the exact invoiced amount. Partial or overpayments require a separate reconciliation.");
    if (input.requestId) {
      const [previousRequest] = await tx.select().from(billingPayment).where(eq(billingPayment.id, input.requestId));
      if (previousRequest) {
        requireValue(previousRequest.invoiceId === invoice.id && previousRequest.reference === reference && previousRequest.paidAt.toISOString().slice(0, 10) === input.paidDate, "This request was already used for a different payment. Refresh before saving.");
        requireValue(!previousRequest.reversedAt, "This payment request was reversed. Refresh before recording a corrected payment.");
        return { id: previousRequest.id, existing: true };
      }
    }
    const [active] = await tx.select().from(billingPayment).where(and(eq(billingPayment.invoiceId, invoice.id), isNull(billingPayment.reversedAt)));
    if (active) {
      requireValue(active.reference === reference && active.paidAt.toISOString().slice(0, 10) === input.paidDate, "This invoice already has a recorded payment. Reverse that entry explicitly before correcting it.");
      return { id: active.id, existing: true };
    }
    requireValue(milestone.status !== "paid", "This step is already marked paid. Reconcile the historical record before adding a payment.");
    const paymentId = input.requestId ?? randomUUID();
    const receiptNumber = `RCPT-${invoice.number}-${paymentId.slice(0, 8).toUpperCase()}`;
    const now = new Date();
    await tx.insert(billingPayment).values({ id: paymentId, invoiceId: invoice.id, amountCents, reference, paidAt, recordedBy: actor.id });
    const snapshot: BillingSnapshot = { ...invoice.snapshot, documentKind: "receipt", number: receiptNumber, issuedAt: now.toISOString(), payment: { id: paymentId, reference, paidAt: paidAt.toISOString(), invoiceNumber: invoice.number } };
    await tx.insert(billingDocument).values({ invoiceId: invoice.id, villaId, paymentId, kind: "receipt", number: receiptNumber, snapshot });
    await tx.update(paymentMilestone).set({ status: "paid", paidAt }).where(eq(paymentMilestone.id, milestoneId));
    await event(tx, actor, projectId, villaId, "billing.payment_recorded", paymentId, `${row.code}: payment for invoice ${invoice.number} received. Your receipt is available.`, true, `/koper/documenten?villa=${villaId}`);
    return { id: paymentId, existing: false };
  });
}

export async function reverseBillingPayment(projectId: string, villaId: string, paymentId: string, reason: string) {
  const actor = await requireActor(true);
  const cleanReason = reason.trim();
  requireValue(cleanReason.length >= 10 && cleanReason.length <= 2000, "Explain the correction (10–2000 characters).");
  return db.transaction(async (tx) => {
    const { row } = await lockVilla(tx, actor, projectId, villaId);
    const [entry] = await tx.select({ payment: billingPayment, invoice: billingInvoice }).from(billingPayment).innerJoin(billingInvoice, eq(billingInvoice.id, billingPayment.invoiceId)).where(and(eq(billingPayment.id, paymentId), eq(billingInvoice.villaId, villaId))).for("update");
    requireValue(entry, "Payment record not found for this residence.");
    if (entry.payment.reversedAt) return { existing: true };
    await tx.update(billingPayment).set({ reversedAt: new Date(), reversedBy: actor.id, reversalReason: cleanReason }).where(and(eq(billingPayment.id, paymentId), isNull(billingPayment.reversedAt)));
    await tx.update(paymentMilestone).set({ status: "open", paidAt: null }).where(eq(paymentMilestone.id, entry.invoice.milestoneId));
    await event(tx, actor, projectId, villaId, "billing.payment_reversed", paymentId, `${row.code}: payment entry for ${entry.invoice.number} corrected: ${cleanReason}. The invoice remains open; its original receipt is retained and marked reversed.`, true);
    return { existing: false };
  });
}

/** Compatibility boundary for old one-click controls. Never toggle or invent a
 * payment reference. The explicit payment form owns settlements and reversals. */
export async function markBillingMilestonePaid(_milestoneId: string, _villaCode: string) {
  await requireActor(true);
  throw new BillingError("Use Billing to issue the invoice and record the payment amount, date and bank reference. Existing paid records are not changed.");
}

export async function getBillingDashboard(projectId: string, villaId?: string) {
  const actor = await requireActor(true);
  return db.transaction(async (tx) => {
    await assertScope(tx, actor, { projectId, villaId }, { developerOnly: true });
    const [issuer] = await tx.select().from(billingIssuer).where(eq(billingIssuer.projectId, projectId));
    const [template] = await tx.select().from(billingScheduleTemplate).where(eq(billingScheduleTemplate.projectId, projectId));
    if (!villaId) return { issuer: issuer ?? null, template: template ?? null, recipient: null, milestones: [], documents: [], payments: [], contractTotal: null };
    const [residence] = await tx.select().from(villa).where(eq(villa.id, villaId));
    const [recipient] = await tx.select().from(billingRecipient).where(eq(billingRecipient.villaId, villaId));
    const steps = await tx.select().from(paymentMilestone).where(eq(paymentMilestone.villaId, villaId)).orderBy(asc(paymentMilestone.sequence), asc(paymentMilestone.id));
    const invoices = await tx.select().from(billingInvoice).where(eq(billingInvoice.villaId, villaId));
    const ids = invoices.map((item) => item.id);
    const payments = ids.length ? await tx.select().from(billingPayment).where(inArray(billingPayment.invoiceId, ids)).orderBy(desc(billingPayment.createdAt)) : [];
    const documents = await tx.select({ id: billingDocument.id, number: billingDocument.number, kind: billingDocument.kind, paymentId: billingDocument.paymentId, createdAt: billingDocument.createdAt }).from(billingDocument).where(eq(billingDocument.villaId, villaId)).orderBy(desc(billingDocument.createdAt));
    const nextId = steps.find((item) => item.status !== "paid")?.id;
    const invoiceMap = new Map(invoices.map((item) => [item.milestoneId, item]));
    return { issuer: issuer ?? null, template: template ?? null, recipient: recipient ?? null, contractTotal: residence.priceTotalUsd,
      milestones: steps.map((step) => { const invoice = invoiceMap.get(step.id); return { ...step, billingStatus: deriveBillingStatus({ paid: step.status === "paid", invoiced: !!invoice, amount: step.amountUsd, dueAt: invoice?.dueAt ?? step.expectedAt, next: step.id === nextId }), invoice: invoice ? { id: invoice.id, number: invoice.number } : null }; }),
      documents: documents.map((doc) => ({ ...doc, reversed: !!payments.find((item) => item.id === doc.paymentId)?.reversedAt, url: `/api/billing/documents/${doc.id}` })), payments,
    };
  });
}

/** Account ownership is part of the query, not a trusted caller assertion. */
export async function getBillingDocumentsForBuyer(accountId: string, villaId: string) {
  return db.select({ id: billingDocument.id, number: billingDocument.number, documentKind: billingDocument.kind, reversedAt: billingPayment.reversedAt, createdAt: billingDocument.createdAt })
    .from(billingDocument).innerJoin(buyerVilla, eq(buyerVilla.villaId, billingDocument.villaId)).innerJoin(buyer, eq(buyer.id, buyerVilla.buyerId)).innerJoin(account, eq(account.id, buyer.accountId)).leftJoin(billingPayment, eq(billingPayment.id, billingDocument.paymentId))
    .where(and(eq(account.id, accountId), eq(account.role, "buyer"), eq(billingDocument.villaId, villaId))).orderBy(desc(billingDocument.createdAt))
    .then((rows) => rows.map((doc) => ({ id: doc.id, label: `${doc.documentKind === "receipt" ? "Receipt" : "Invoice"} ${doc.number}${doc.reversedAt ? " — reversed" : ""}`, note: doc.reversedAt ? "Payment entry reversed. Original document retained for the audit trail." : "Issued payment document · USD", kind: "doc" as const, url: `/api/billing/documents/${doc.id}`, createdAt: doc.createdAt })));
}

export async function getBillingStatusForMilestones(accountId: string, villaId: string) {
  const rows = await db.select({ milestone: paymentMilestone, invoiceId: billingInvoice.id, invoiceDueAt: billingInvoice.dueAt })
    .from(paymentMilestone).innerJoin(buyerVilla, eq(buyerVilla.villaId, paymentMilestone.villaId)).innerJoin(buyer, eq(buyer.id, buyerVilla.buyerId)).innerJoin(account, eq(account.id, buyer.accountId)).leftJoin(billingInvoice, eq(billingInvoice.milestoneId, paymentMilestone.id))
    .where(and(eq(account.id, accountId), eq(account.role, "buyer"), eq(paymentMilestone.villaId, villaId))).orderBy(asc(paymentMilestone.sequence), asc(paymentMilestone.id));
  const nextId = rows.find(({ milestone }) => milestone.status !== "paid")?.milestone.id;
  return new Map(rows.map(({ milestone, invoiceId, invoiceDueAt }) => [milestone.id, deriveBillingStatus({ paid: milestone.status === "paid", invoiced: !!invoiceId, dueAt: invoiceDueAt ?? milestone.expectedAt, amount: milestone.amountUsd, next: milestone.id === nextId })]));
}

export async function getAuthorizedBillingDocument(id: string) {
  const actor = await requireActor();
  if (actor.role !== "developer" && actor.role !== "buyer") return null;
  if (actor.role === "buyer") {
    const [owned] = await db.select({ document: billingDocument, reversedAt: billingPayment.reversedAt, reversalReason: billingPayment.reversalReason }).from(billingDocument).innerJoin(buyerVilla, eq(buyerVilla.villaId, billingDocument.villaId)).innerJoin(buyer, eq(buyer.id, buyerVilla.buyerId)).leftJoin(billingPayment, eq(billingPayment.id, billingDocument.paymentId)).where(and(eq(billingDocument.id, id), eq(buyer.accountId, actor.id))).limit(1);
    return owned ?? null;
  }
  const [row] = await db.select({ document: billingDocument, reversedAt: billingPayment.reversedAt, reversalReason: billingPayment.reversalReason }).from(billingDocument).leftJoin(billingPayment, eq(billingPayment.id, billingDocument.paymentId)).where(eq(billingDocument.id, id));
  return row ?? null;
}
