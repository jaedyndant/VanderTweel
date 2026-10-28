// Koper-app datatoegang (MS3). TO hfst. 9 / PvA MS3 klaar-criterium: "Een
// koper ziet zijn eigen villa en niets van een ander." This file is the
// single place that decides which villa(s) an authenticated buyer may see —
// every (koper) page/query MUST go through resolveAuthorizedVillaId (or the
// wrappers below that call it), never trust a client-supplied villa id on
// its own.
//
// Written TDD-first (see koper-data.test.ts): the pure authorization
// function below has no DB dependency at all, so the isolation guarantee is
// provable without a database in the loop.

import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { buyer, buyerVilla, villa, paymentMilestone, progressTask, update, file } from "@/db/schema";

/**
 * Pure authorization gate — no DB access, fully unit-testable.
 *
 * Given the set of villa ids a buyer is actually linked to (`ownedVillaIds`,
 * from the `buyer_villa` join table — never from a client-supplied value),
 * decide which single villa id the buyer may see right now:
 *   - no requested id -> the buyer's own villa (first/only linked one)
 *   - a requested id that IS in ownedVillaIds -> that id
 *   - a requested id that is NOT in ownedVillaIds -> null (never leaks another
 *     buyer's villa id back, regardless of how the id was guessed/supplied)
 *
 * Fails closed: an empty ownedVillaIds list always returns null, never a
 * fallback villa.
 */
export function resolveAuthorizedVillaId(
  ownedVillaIds: readonly string[],
  requestedVillaId?: string | null
): string | null {
  if (requestedVillaId) {
    return ownedVillaIds.includes(requestedVillaId) ? requestedVillaId : null;
  }
  return ownedVillaIds[0] ?? null;
}

/** All villa ids the given account (by account id) is linked to as a buyer. */
export async function getOwnedVillaIdsForAccount(accountId: string): Promise<string[]> {
  const buyerRow = await db.query.buyer.findFirst({ where: eq(buyer.accountId, accountId) });
  if (!buyerRow) return [];
  const links = await db.query.buyerVilla.findMany({
    where: eq(buyerVilla.buyerId, buyerRow.id),
  });
  return links.map((l) => l.villaId);
}

/**
 * The single server-side authorization checkpoint every koper-app query
 * below goes through: resolves which villa (if any) this account may view,
 * then fetches it — never fetches by a raw client-supplied villa id alone.
 */
export async function getAuthorizedVilla(accountId: string, requestedVillaId?: string | null) {
  const ownedVillaIds = await getOwnedVillaIdsForAccount(accountId);
  const villaId = resolveAuthorizedVillaId(ownedVillaIds, requestedVillaId);
  if (!villaId) return null;
  const villaRow = await db.query.villa.findFirst({ where: eq(villa.id, villaId) });
  return villaRow ?? null;
}

/** "Eigen villa" screen: villa details + the buyer's own name. */
export async function getVillaOverview(accountId: string, requestedVillaId?: string | null) {
  const villaRow = await getAuthorizedVilla(accountId, requestedVillaId);
  if (!villaRow) return null;
  const buyerRow = await db.query.buyer.findFirst({ where: eq(buyer.accountId, accountId) });
  return { villa: villaRow, buyerName: buyerRow?.name ?? null };
}

/** "Voortgang" screen: build phases for the buyer's own (authorized) villa. */
export async function getVillaProgress(accountId: string, requestedVillaId?: string | null) {
  const villaRow = await getAuthorizedVilla(accountId, requestedVillaId);
  if (!villaRow) return null;
  const tasks = await db.query.progressTask.findMany({
    where: eq(progressTask.villaId, villaRow.id),
    orderBy: asc(progressTask.sequence),
  });
  const updates = await db.query.update.findMany({
    where: eq(update.villaId, villaRow.id),
    orderBy: desc(update.createdAt),
  });
  return { villa: villaRow, tasks, updates };
}

/** "Betaalschema" screen: payment milestones for the buyer's own (authorized) villa. */
export async function getPaymentSchedule(accountId: string, requestedVillaId?: string | null) {
  const villaRow = await getAuthorizedVilla(accountId, requestedVillaId);
  if (!villaRow) return null;
  const milestones = await db.query.paymentMilestone.findMany({
    where: eq(paymentMilestone.villaId, villaRow.id),
    orderBy: asc(paymentMilestone.sequence),
  });
  const documents = await db.query.file.findMany({
    where: eq(file.villaId, villaRow.id),
    orderBy: desc(file.createdAt),
  });
  return { villa: villaRow, milestones, documents };
}
