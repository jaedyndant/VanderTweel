import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { account, buyer, buyerVilla, paymentMilestone, pmProject, project, projectManager, villa } from "@/db/schema";
import { accountInvitation, managementRequest } from "@/db/management-schema";
import { billingInvoice } from "@/db/billing-schema";
import { mailOutbox } from "@/db/events-schema";
import { writePlatformEvent } from "@/lib/platform-events";
import { queueDirectEmail } from "@/lib/mail-outbox";
import {
  ensureCompatibleRole, ensureInviteCooldown, invitationSchema, ManagementError,
  parseManagementInput, requireDeveloper, requireExactSelection, requireUnsharedSelection,
  resendSchema, villaInputSchema,
} from "./validation";
import type { ManagedVilla, ManagementData } from "./types";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Actor = { id: string; role: string };
type VillaRow = typeof villa.$inferSelect;

function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function sameContractTotal(left: string | null, right: string | null) {
  if (left === null || right === null) return left === right;
  // Inputs and database numerics have at most two fractional digits. Compare
  // exact cents, so editing another field with 155000 instead of 155000.00
  // is not treated as changing a contract, and no rounding is introduced.
  const cents = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  };
  return cents(left) === cents(right);
}

function villaFields(row: VillaRow) {
  return {
    id: row.id, projectId: row.projectId, code: row.code, status: row.status,
    typeLabel: row.typeLabel, plotM2: row.plotM2, builtM2: row.builtM2, outdoorM2: row.outdoorM2,
    leaseYears: row.leaseYears, pricePackage: row.pricePackage, priceTotalUsd: row.priceTotalUsd,
    buildStarted: row.buildStarted?.toISOString().slice(0, 10) ?? null,
    handoverExpected: row.handoverExpected?.toISOString().slice(0, 10) ?? null,
  };
}

export function managedVilla(row: VillaRow): ManagedVilla {
  const fields = villaFields(row);
  return { ...fields, revision: digest(fields) };
}

async function lock(tx: Transaction, key: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
}

async function once<T extends Record<string, unknown>>(
  actor: Actor, requestId: string, kind: string, input: unknown, operation: (tx: Transaction) => Promise<T>,
): Promise<T> {
  requireDeveloper(actor);
  return db.transaction(async (tx) => {
    // Recheck current database role, not just the role signed into an older JWT.
    const [currentActor] = await tx.select({ role: account.role }).from(account).where(eq(account.id, actor.id)).for("share");
    if (!currentActor || currentActor.role !== "developer") throw new ManagementError("Your account can no longer manage this platform.", 403);
    await lock(tx, `management-request:${requestId}`);
    const [receipt] = await tx.select().from(managementRequest).where(eq(managementRequest.id, requestId));
    const requestDigest = digest(input);
    if (receipt) {
      if (receipt.actorId !== actor.id || receipt.kind !== kind || receipt.requestDigest !== requestDigest) {
        throw new ManagementError("This request identifier was already used for a different operation. Refresh the form.", 409);
      }
      return receipt.result as T;
    }
    const result = await operation(tx);
    await tx.insert(managementRequest).values({ id: requestId, actorId: actor.id, kind, requestDigest, result });
    return result;
  });
}

function invitationLoginUrl() {
  const base = process.env.APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!base) throw new ManagementError("The platform login URL is not configured. No invitation has been created.", 503);
  let url: URL;
  try { url = new URL(base); } catch { throw new ManagementError("The platform login URL is invalid.", 503); }
  if (url.username || url.password || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new ManagementError("The platform login URL must use HTTPS.", 503);
  }
  return new URL("/login", url.origin).toString();
}

async function queueInvitation(tx: Transaction, input: { invitationId: string; requestId: string; email: string; role: string; name: string; loginUrl: string }) {
  await queueDirectEmail(tx, {
    idempotencyKey: `invitation:${input.requestId}`,
    recipient: input.email,
    subject: "Your Van der Tweel platform invitation",
    text: `Hello ${input.name},\n\nYou have been invited to the Van der Tweel ${input.role === "buyer" ? "owner platform" : "project manager workspace"}.\n\nOpen ${input.loginUrl} and enter this email address to request your secure, one-time sign-in link. Only the residences or projects assigned to your account are available.\n\nThis invitation is not a sign-in link and never signs you in automatically.\n\nVan der Tweel`,
    sourceType: "invitation", sourceId: input.invitationId,
  });
}

export async function inviteAccount(actor: Actor, raw: unknown) {
  requireDeveloper(actor);
  const input = parseManagementInput(invitationSchema, raw);
  const loginUrl = invitationLoginUrl();
  return once(actor, input.requestId, "account.invite", input, async (tx) => {
    await lock(tx, `management-email:${input.email}`);
    let [user] = await tx.select().from(account).where(sql`lower(${account.email}) = ${input.email}`).for("update");
    ensureCompatibleRole(user?.role, input.role);
    const selectedVillas = input.villaIds.length ? await tx.select().from(villa).where(inArray(villa.id, input.villaIds)).orderBy(asc(villa.id)).for("update") : [];
    const selectedProjects = input.projectIds.length ? await tx.select().from(project).where(inArray(project.id, input.projectIds)).for("share") : [];
    requireExactSelection(input.villaIds, selectedVillas.map((row) => row.id));
    requireExactSelection(input.projectIds, selectedProjects.map((row) => row.id));
    if (!user) {
      [user] = await tx.insert(account).values({ email: input.email, role: input.role, displayName: input.name }).returning();
    }
    const [previousInvite] = await tx.select().from(accountInvitation).where(eq(accountInvitation.accountId, user.id)).for("update");
    ensureInviteCooldown(previousInvite?.lastRequestedAt, new Date());
    if (user.displayName !== input.name) {
      await tx.update(account).set({ displayName: input.name }).where(eq(account.id, user.id));
    }

    if (input.role === "buyer") {
      let [profile] = await tx.select().from(buyer).where(eq(buyer.accountId, user.id));
      if (!profile) [profile] = await tx.insert(buyer).values({ accountId: user.id, name: input.name }).returning();
      const shared = await tx.select({ buyerId: buyerVilla.buyerId }).from(buyerVilla).where(and(inArray(buyerVilla.villaId, input.villaIds), ne(buyerVilla.buyerId, profile.id)));
      requireUnsharedSelection(shared.map((row) => row.buyerId), input.allowSharedVilla);
      await tx.insert(buyerVilla).values(input.villaIds.map((villaId) => ({ buyerId: profile.id, villaId }))).onConflictDoNothing();
    } else {
      let [profile] = await tx.select().from(projectManager).where(eq(projectManager.accountId, user.id));
      if (!profile) [profile] = await tx.insert(projectManager).values({ accountId: user.id }).returning();
      await tx.insert(pmProject).values(input.projectIds.map((projectId) => ({ pmId: profile.id, projectId }))).onConflictDoNothing();
    }
    const now = new Date();
    const [invitation] = await tx.insert(accountInvitation).values({
      accountId: user.id, invitedBy: actor.id, deliveryCount: 1, lastRequestedAt: now,
    }).onConflictDoUpdate({ target: accountInvitation.accountId, set: {
      invitedBy: actor.id, deliveryCount: sql`${accountInvitation.deliveryCount} + 1`, lastRequestedAt: now,
    } }).returning();
    await queueInvitation(tx, { invitationId: invitation.id, requestId: input.requestId, email: user.email, role: input.role, name: input.name, loginUrl });
    const eventScopes = input.role === "buyer"
      ? selectedVillas.map((row) => ({ projectId: row.projectId, villaId: row.id, label: row.code }))
      : input.projectIds.map((projectId) => ({ projectId, villaId: undefined, label: "project" }));
    for (const scope of eventScopes) await writePlatformEvent(tx, {
      actorId: actor.id, projectId: scope.projectId, villaId: scope.villaId, action: "account.invited", targetId: user.id,
      summary: `${input.role === "buyer" ? "Buyer" : "Project manager"} invitation queued; access confirmed for ${scope.label}.`, notify: false, pmSafe: false,
    });
    return { accountId: user.id, invitationId: invitation.id, state: "queued", message: "Access is saved and the invitation is queued. Mail delivery is tracked separately." };
  });
}

export async function resendInvitation(actor: Actor, raw: unknown) {
  requireDeveloper(actor);
  const input = parseManagementInput(resendSchema, raw);
  const loginUrl = invitationLoginUrl();
  return once(actor, input.requestId, "account.resend", input, async (tx) => {
    const [user] = await tx.select().from(account).where(eq(account.id, input.accountId)).for("update");
    if (!user || !["buyer", "pm"].includes(user.role)) throw new ManagementError("This account cannot receive an invitation.", 404);
    const [invitation] = await tx.select().from(accountInvitation).where(eq(accountInvitation.accountId, user.id)).for("update");
    if (!invitation) throw new ManagementError("No invitation exists for this account. Use the invitation form to confirm its assigned access.", 409);
    ensureInviteCooldown(invitation.lastRequestedAt, new Date());
    const scopes = user.role === "buyer"
      ? await tx.select({ projectId: villa.projectId }).from(buyer).innerJoin(buyerVilla, eq(buyer.id, buyerVilla.buyerId)).innerJoin(villa, eq(villa.id, buyerVilla.villaId)).where(eq(buyer.accountId, user.id))
      : await tx.select({ projectId: pmProject.projectId }).from(projectManager).innerJoin(pmProject, eq(pmProject.pmId, projectManager.id)).where(eq(projectManager.accountId, user.id));
    if (!scopes.length) throw new ManagementError("Assign this account to a residence or project before sending another invitation.", 409);
    await tx.update(accountInvitation).set({ lastRequestedAt: new Date(), deliveryCount: sql`${accountInvitation.deliveryCount} + 1`, invitedBy: actor.id }).where(eq(accountInvitation.id, invitation.id));
    const [profile] = user.role === "buyer" ? await tx.select().from(buyer).where(eq(buyer.accountId, user.id)) : [];
    await queueInvitation(tx, { invitationId: invitation.id, requestId: input.requestId, email: user.email, role: user.role, name: profile?.name ?? user.displayName ?? "there", loginUrl });
    for (const projectId of new Set(scopes.map((scope) => scope.projectId))) await writePlatformEvent(tx, {
      actorId: actor.id, projectId, action: "account.invite_resent", targetId: user.id,
      summary: "A replacement account invitation was queued. Assigned access is unchanged.", notify: false, pmSafe: false,
    });
    return { accountId: user.id, invitationId: invitation.id, state: "queued", message: "A fresh invitation is queued. The existing role and access are unchanged." };
  });
}

export async function saveVilla(actor: Actor, raw: unknown) {
  requireDeveloper(actor);
  const input = parseManagementInput(villaInputSchema, raw);
  return once(actor, input.requestId, "villa.save", input, async (tx) => {
    await lock(tx, `management-villa-code:${input.code.toLowerCase()}`);
    const [selectedProject] = await tx.select({ id: project.id }).from(project).where(eq(project.id, input.projectId)).for("share");
    if (!selectedProject) throw new ManagementError("This project no longer exists. Refresh the form.", 409);
    const [current] = input.id ? await tx.select().from(villa).where(eq(villa.id, input.id)).for("update") : [];
    if (input.id && !current) throw new ManagementError("This residence no longer exists.", 404);
    if (current && managedVilla(current).revision !== input.expectedRevision) throw new ManagementError("This residence changed while you were editing. Cancel this edit, refresh the list and reopen its latest details before saving.", 409);
    if (current && current.projectId !== input.projectId) throw new ManagementError("An existing residence cannot be moved between projects: its buyer, payment and team records must stay together.", 409);
    if (current && !sameContractTotal(current.priceTotalUsd, input.priceTotalUsd)) {
      // Billing mutations take this same residence row lock before creating or
      // replacing schedules and invoices. Check only after acquiring it: a
      // concurrent invoice cannot slip between validation and this update.
      const issued = await tx.select({ id: billingInvoice.id }).from(billingInvoice).where(eq(billingInvoice.villaId, current.id)).limit(1);
      const schedule = await tx.select({ status: paymentMilestone.status, paidAt: paymentMilestone.paidAt }).from(paymentMilestone).where(eq(paymentMilestone.villaId, current.id));
      if (issued.length || schedule.some((step) => step.status === "paid" || step.paidAt !== null)) {
        throw new ManagementError("The contract total cannot change because this residence has issued invoices or recorded payments. Keep the original total and reconcile any contract amendment with the finance team; existing documents and amounts are preserved.", 409);
      }
      if (schedule.length) {
        throw new ManagementError("This residence already has an unissued payment schedule. Review and explicitly reset that schedule with the finance team before changing the contract total. No schedule amounts have been changed.", 409);
      }
    }
    const duplicates = await tx.select({ id: villa.id }).from(villa).where(sql`lower(${villa.code}) = ${input.code.toLowerCase()}`);
    if (duplicates.some((row) => row.id !== current?.id)) throw new ManagementError("This villa code is already in use. Choose a unique code.", 409);
    const values = {
      projectId: input.projectId, code: input.code, status: input.status, typeLabel: input.typeLabel,
      plotM2: input.plotM2, builtM2: input.builtM2, outdoorM2: input.outdoorM2,
      leaseYears: input.leaseYears, pricePackage: input.pricePackage, priceTotalUsd: input.priceTotalUsd,
      buildStarted: input.buildStarted ? new Date(input.buildStarted) : null,
      handoverExpected: input.handoverExpected ? new Date(input.handoverExpected) : null,
    };
    const [saved] = current
      ? await tx.update(villa).set(values).where(eq(villa.id, current.id)).returning()
      : await tx.insert(villa).values(values).returning();
    await writePlatformEvent(tx, {
      actorId: actor.id, projectId: saved.projectId, villaId: saved.id,
      action: current ? "villa.updated" : "villa.created", targetId: saved.id,
      summary: `${saved.code}: residence details ${current ? "updated" : "created"}.`, notify: false, pmSafe: false,
    });
    return { villa: managedVilla(saved), message: "Residence details saved. Existing payments, documents and buyer links were preserved." };
  });
}

export async function getManagementData(actor: Actor): Promise<ManagementData> {
  requireDeveloper(actor);
  // No buyer email, financial or invitation information is returned to a PM.
  const [currentActor] = await db.select({ role: account.role }).from(account).where(eq(account.id, actor.id));
  if (currentActor?.role !== "developer") throw new ManagementError("Developer access is required.", 403);
  const [users, buyerLinks, managerLinks, villas] = await Promise.all([
    db.select({ user: account, profile: buyer, invitation: accountInvitation }).from(account)
      .leftJoin(buyer, eq(buyer.accountId, account.id)).leftJoin(accountInvitation, eq(accountInvitation.accountId, account.id))
      .where(inArray(account.role, ["buyer", "pm"])).orderBy(asc(account.email)),
    db.select({ accountId: buyer.accountId, villaId: buyerVilla.villaId }).from(buyerVilla).innerJoin(buyer, eq(buyer.id, buyerVilla.buyerId)),
    db.select({ accountId: projectManager.accountId, projectId: pmProject.projectId }).from(pmProject).innerJoin(projectManager, eq(projectManager.id, pmProject.pmId)),
    db.select().from(villa).orderBy(asc(villa.code)),
  ]);
  const invitationIds = users.flatMap(({ invitation }) => invitation ? [invitation.id] : []);
  const deliveries = invitationIds.length ? await db.select({ sourceId: mailOutbox.sourceId, status: mailOutbox.status })
    .from(mailOutbox).where(and(eq(mailOutbox.sourceType, "invitation"), inArray(mailOutbox.sourceId, invitationIds)))
    .orderBy(desc(mailOutbox.createdAt)) : [];
  const latestDelivery = new Map<string, string>();
  for (const delivery of deliveries) if (!latestDelivery.has(delivery.sourceId)) latestDelivery.set(delivery.sourceId, delivery.status);
  const deliveryState = (id: string) => {
    const state = latestDelivery.get(id);
    return state === "pending" ? "queued" : state === "processing" ? "sending" : state === "sent" || state === "failed" ? state : "unknown";
  };
  return {
    accounts: users.map(({ user, profile, invitation }) => ({
      id: user.id, email: user.email, role: user.role as "buyer" | "pm", name: profile?.name ?? user.displayName ?? user.email,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      villaIds: buyerLinks.filter((row) => row.accountId === user.id).map((row) => row.villaId),
      projectIds: managerLinks.filter((row) => row.accountId === user.id).map((row) => row.projectId),
      invitation: invitation ? { requestedAt: invitation.lastRequestedAt.toISOString(), deliveryCount: invitation.deliveryCount, state: deliveryState(invitation.id) } : null,
    })),
    villas: villas.map(managedVilla),
  };
}
