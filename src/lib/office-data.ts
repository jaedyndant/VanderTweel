// Back-office datatoegang (MS4). TO 1.3 / PvA MS4 klaar-criterium:
// "Ontwikkelaar ziet alle projecten; pm ziet alleen zijn eigen projecten,
// geen betalingen." Same philosophy as koper-data.ts: every (office) page
// MUST go through the functions below, never query villa/project/payment
// tables directly from a page component — this file is the single place
// that decides what a pm vs a developer may see, enforced at the query
// layer, not only by hiding UI elements (TO 9.1).
//
// Critically: for a pm account, getVillaForOffice never even issues the
// paymentMilestone/file queries (not "fetches then hides") — see the tests
// in office-data.test.ts that assert the mocked queries were never called.

import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  project,
  villa,
  buyer,
  buyerVilla,
  projectManager,
  pmProject,
  progressTask,
  paymentMilestone,
  update,
  file,
} from "@/db/schema";

export type OfficeRole = "pm" | "developer";

/**
 * Pure authorization gate — no DB. A developer is authorized for every
 * project (TO 1.3: "ontwikkelaar ziet alle projecten"); a pm is authorized
 * only for project ids in their own pm_project links. Fails closed: an
 * unrecognized role is authorized for nothing.
 */
export function isAuthorizedForProject(
  role: OfficeRole,
  pmProjectIds: readonly string[],
  requestedProjectId: string
): boolean {
  if (role === "developer") return true;
  if (role === "pm") return pmProjectIds.includes(requestedProjectId);
  return false;
}

/** All project ids this account manages as a pm (empty for developer — not needed). */
async function getPmProjectIds(accountId: string): Promise<string[]> {
  const pmRow = await db.query.projectManager.findFirst({
    where: eq(projectManager.accountId, accountId),
  });
  if (!pmRow) return [];
  const links = await db.query.pmProject.findMany({ where: eq(pmProject.pmId, pmRow.id) });
  return links.map((l) => l.projectId);
}

/** Project ids this account may see right now, per its role. */
export async function getAccessibleProjectIds(
  accountId: string,
  role: OfficeRole
): Promise<string[]> {
  if (role === "developer") {
    const rows = await db.query.project.findMany();
    return rows.map((p) => p.id);
  }
  return getPmProjectIds(accountId);
}

/** "Projecten" dashboard: every accessible project, with its villa count. */
export async function getProjectsOverview(accountId: string, role: OfficeRole) {
  const accessibleIds = await getAccessibleProjectIds(accountId, role);
  if (accessibleIds.length === 0) return [];
  const projects = await db.query.project.findMany({ where: inArray(project.id, accessibleIds) });
  const villas = await db.query.villa.findMany({ where: inArray(villa.projectId, accessibleIds) });
  return projects.map((p) => ({
    ...p,
    villaCount: villas.filter((v) => v.projectId === p.id).length,
  }));
}

/** Project detail: villa list with buyer name + status, scoped by role. */
export async function getProjectDetail(accountId: string, role: OfficeRole, slug: string) {
  const projectRow = await db.query.project.findFirst({ where: eq(project.slug, slug) });
  if (!projectRow) return null;

  const pmProjectIds = role === "pm" ? await getPmProjectIds(accountId) : [];
  if (!isAuthorizedForProject(role, pmProjectIds, projectRow.id)) return null;

  const villas = await db.query.villa.findMany({
    where: eq(villa.projectId, projectRow.id),
    orderBy: asc(villa.code),
  });
  const villaIds = villas.map((v) => v.id);
  const links = villaIds.length
    ? await db.query.buyerVilla.findMany({ where: inArray(buyerVilla.villaId, villaIds) })
    : [];
  const buyerIds = links.map((l) => l.buyerId);
  const buyers = buyerIds.length
    ? await db.query.buyer.findMany({ where: inArray(buyer.id, buyerIds) })
    : [];

  const villasWithBuyer = villas.map((v) => {
    const link = links.find((l) => l.villaId === v.id);
    const buyerRow = link ? buyers.find((b) => b.id === link.buyerId) : undefined;
    return { ...v, buyerName: buyerRow?.name ?? null };
  });

  return { project: projectRow, villas: villasWithBuyer };
}

/**
 * Server-side authorization checkpoint for every villa subpage: resolves
 * the villa by code and confirms this account's role grants access to the
 * villa's project. Returns null (never partial data) when not authorized —
 * every villa subpage function below calls this FIRST and returns early.
 */
export async function getAuthorizedOfficeVilla(accountId: string, role: OfficeRole, code: string) {
  const villaRow = await db.query.villa.findFirst({ where: eq(villa.code, code) });
  if (!villaRow) return null;
  const pmProjectIds = role === "pm" ? await getPmProjectIds(accountId) : [];
  if (!isAuthorizedForProject(role, pmProjectIds, villaRow.projectId)) return null;
  return villaRow;
}

/**
 * Villa hub screen. TO 1.3: pm screens have no money, no contract files —
 * milestones/files are `null` for a pm, and the underlying queries are
 * never issued for a pm at all (not fetched-then-hidden).
 */
export async function getVillaForOffice(accountId: string, role: OfficeRole, code: string) {
  const villaRow = await getAuthorizedOfficeVilla(accountId, role, code);
  if (!villaRow) return null;

  const projectRow = await db.query.project.findFirst({ where: eq(project.id, villaRow.projectId) });
  const buyerLink = await db.query.buyerVilla.findFirst({ where: eq(buyerVilla.villaId, villaRow.id) });
  const buyerRow = buyerLink
    ? await db.query.buyer.findFirst({ where: eq(buyer.id, buyerLink.buyerId) })
    : null;
  const tasks = await db.query.progressTask.findMany({
    where: eq(progressTask.villaId, villaRow.id),
    orderBy: asc(progressTask.sequence),
  });
  const updates = await db.query.update.findMany({
    where: eq(update.villaId, villaRow.id),
    orderBy: desc(update.createdAt),
  });

  const milestones =
    role === "developer"
      ? await db.query.paymentMilestone.findMany({
          where: eq(paymentMilestone.villaId, villaRow.id),
          orderBy: asc(paymentMilestone.sequence),
        })
      : null;
  const files =
    role === "developer"
      ? await db.query.file.findMany({
          where: eq(file.villaId, villaRow.id),
          orderBy: desc(file.createdAt),
        })
      : null;

  return {
    villa: villaRow,
    project: projectRow ?? null,
    buyerName: buyerRow?.name ?? null,
    tasks,
    updates,
    milestones,
    files,
  };
}

/**
 * Buyer directory. TO 1.3: this is one of the 9 developer-only screens — a
 * pm never gets a cross-project buyer list. Returns null for a pm rather
 * than an empty array, so a page can distinguish "not allowed" from "no
 * buyers yet".
 */
export async function getBuyersDirectory(role: OfficeRole) {
  if (role !== "developer") return null;
  const buyers = await db.query.buyer.findMany({ orderBy: asc(buyer.name) });
  const links = await db.query.buyerVilla.findMany();
  const villaIds = links.map((l) => l.villaId);
  const villas = villaIds.length
    ? await db.query.villa.findMany({ where: inArray(villa.id, villaIds) })
    : [];
  return buyers.map((b) => {
    const ownLinks = links.filter((l) => l.buyerId === b.id);
    const ownVillas = ownLinks
      .map((l) => villas.find((v) => v.id === l.villaId))
      .filter((v): v is NonNullable<typeof v> => Boolean(v));
    return { ...b, villas: ownVillas };
  });
}
