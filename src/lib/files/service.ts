import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { account, buyer, buyerVilla, villa, file as legacyFile } from "@/db/schema";
import { managedAsset, assetVersion, uploadIntent } from "@/db/files-schema";
import { requireActor, assertScope } from "@/lib/platform-access";
import { writePlatformEvent } from "@/lib/platform-events";
import { safeDocumentUrl } from "@/components/client-platform/presentation";
import { checkRateLimit } from "@/lib/rate-limit";
import { FileError, assertIntentUsable, assertPhotoPermission, assertRevision, intentSchema, patchSchema, privateFileHeaders, scopeSchema } from "./policy";
import { inspectStoredUpload, localStorageEnabled, readStoredFile, storageConfigured, writeLocalUpload } from "./storage";

type Asset = typeof managedAsset.$inferSelect;
const assetScope = (asset: Asset) => ({ projectId: asset.projectId, ...(asset.villaId ? { villaId: asset.villaId } : {}) });
const publicAsset = (asset: Asset) => ({ id: asset.id, projectId: asset.projectId, villaId: asset.villaId, kind: asset.kind, label: asset.label, note: asset.note, visibility: asset.visibility, revision: asset.revision, archivedAt: asset.archivedAt, createdAt: asset.createdAt, updatedAt: asset.updatedAt, url: `/api/files/${asset.id}` });

export async function createUploadIntent(input: unknown) {
  const data = intentSchema.parse(input);
  const actor = await requireActor();
  assertPhotoPermission(actor.role, data.kind);
  if (!storageConfigured()) throw new FileError("Private file storage is not configured yet.", 503);
  if (!await checkRateLimit(`files:upload:${actor.id}`, 40, 600)) throw new FileError("Too many uploads. Please try again shortly.", 429);
  return db.transaction(async tx => {
    await assertScope(tx, actor, data);
    let asset: Asset;
    if (data.assetId) {
      const [existing] = await tx.select().from(managedAsset).where(eq(managedAsset.id, data.assetId)).for("update");
      if (!existing || existing.projectId !== data.projectId || existing.villaId !== (data.villaId ?? null) || existing.kind !== data.kind) throw new FileError("File not found.", 404);
      assertPhotoPermission(actor.role, existing.kind);
      if (existing.archivedAt) throw new FileError("Restore this file before replacing it.", 409);
      assertRevision(existing.revision, data.expectedRevision!);
      asset = existing;
    } else {
      [asset] = await tx.insert(managedAsset).values({ projectId: data.projectId, villaId: data.villaId, kind: data.kind, label: data.label, note: data.note, createdBy: actor.id }).returning();
    }
    const id = randomUUID();
    const extension = data.fileName.split(".").at(-1)!.toLowerCase();
    const pathname = `managed/${asset.id}/${id}.${extension}`;
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    await tx.insert(uploadIntent).values({ id, assetId: asset.id, actorId: actor.id, storagePath: pathname, fileName: data.fileName, contentType: data.contentType, byteSize: data.byteSize, expectedRevision: asset.revision, expiresAt });
    return { intentId: id, assetId: asset.id, pathname, expiresAt, driver: localStorageEnabled() ? "local" : "blob" };
  });
}

export async function authorizeUploadToken(pathname: string, intentId: string) {
  z.uuid().parse(intentId);
  const actor = await requireActor();
  const [row] = await db.select({ intent: uploadIntent, asset: managedAsset }).from(uploadIntent).innerJoin(managedAsset, eq(uploadIntent.assetId, managedAsset.id)).where(eq(uploadIntent.id, intentId));
  if (!row || row.intent.storagePath !== pathname) throw new FileError("Upload not found.", 404);
  assertIntentUsable(row.intent, actor.id);
  assertPhotoPermission(actor.role, row.asset.kind);
  await assertScope(db, actor, assetScope(row.asset));
  if (row.asset.archivedAt) throw new FileError("This file has been archived.", 409);
  assertRevision(row.asset.revision, row.intent.expectedRevision);
  return row.intent;
}

export async function acceptLocalUpload(intentId: string, bytes: Uint8Array) {
  if (!localStorageEnabled()) throw new FileError("Not found.", 404);
  const [intent] = await db.select().from(uploadIntent).where(eq(uploadIntent.id, z.uuid().parse(intentId)));
  if (!intent) throw new FileError("Upload not found.", 404);
  await authorizeUploadToken(intent.storagePath, intentId);
  if (bytes.length !== intent.byteSize) throw new FileError("The uploaded file size does not match.");
  await writeLocalUpload(intent.storagePath, intent.contentType, bytes);
}

export async function finalizeUpload(assetId: string, intentId: string) {
  z.uuid().parse(assetId); z.uuid().parse(intentId);
  const actor = await requireActor();
  const [candidate] = await db.select().from(uploadIntent).where(and(eq(uploadIntent.id, intentId), eq(uploadIntent.assetId, assetId), eq(uploadIntent.actorId, actor.id)));
  if (!candidate) throw new FileError("Upload not found.", 404);
  // Storage verification is done outside the transaction; immutable unique paths
  // and allowOverwrite:false make those verified bytes stable while acquiring locks.
  if (!candidate.finalizedAt) {
    assertIntentUsable(candidate, actor.id);
    await inspectStoredUpload(candidate.storagePath, candidate);
  }
  return db.transaction(async tx => {
    const [asset] = await tx.select().from(managedAsset).where(eq(managedAsset.id, assetId)).for("update");
    if (!asset) throw new FileError("File not found.", 404);
    assertPhotoPermission(actor.role, asset.kind);
    await assertScope(tx, actor, assetScope(asset));
    const [intent] = await tx.select().from(uploadIntent).where(eq(uploadIntent.id, intentId)).for("update");
    if (!intent || intent.actorId !== actor.id || intent.assetId !== asset.id) throw new FileError("Upload not found.", 404);
    // Retrying a completed intent never creates a second version or notification.
    if (intent.finalizedAt) return publicAsset(asset);
    assertIntentUsable(intent, actor.id);
    assertRevision(asset.revision, intent.expectedRevision);
    if (asset.archivedAt) throw new FileError("This file has been archived.", 409);
    const sequence = asset.activeVersion + 1;
    await tx.insert(assetVersion).values({ assetId, sequence, storagePath: intent.storagePath, fileName: intent.fileName, contentType: intent.contentType, byteSize: intent.byteSize, uploadedBy: actor.id });
    // Replacements are drafts too: old shared bytes stop being available immediately.
    const [saved] = await tx.update(managedAsset).set({ activeVersion: sequence, revision: asset.revision + 1, visibility: "internal", updatedAt: new Date() }).where(eq(managedAsset.id, assetId)).returning();
    await tx.update(uploadIntent).set({ finalizedAt: new Date() }).where(eq(uploadIntent.id, intentId));
    await writePlatformEvent(tx, { actorId: actor.id, projectId: asset.projectId, villaId: asset.villaId, action: sequence === 1 ? "file.upload" : "file.replace", targetId: asset.id, summary: `${sequence === 1 ? "Uploaded" : "Replaced"} ${asset.label}`, notify: false, pmSafe: asset.kind === "photo" });
    return publicAsset(saved);
  });
}

export async function changeManagedFile(id: string, input: unknown) {
  z.uuid().parse(id); const data = patchSchema.parse(input); const actor = await requireActor();
  return db.transaction(async tx => {
    const [asset] = await tx.select().from(managedAsset).where(eq(managedAsset.id, id)).for("update");
    if (!asset || !asset.activeVersion) throw new FileError("File not found.", 404);
    assertPhotoPermission(actor.role, asset.kind); await assertScope(tx, actor, assetScope(asset)); assertRevision(asset.revision, data.expectedRevision);
    if (asset.archivedAt && data.action !== "restore") throw new FileError("Restore this file first.", 409);
    const patch: Partial<typeof managedAsset.$inferInsert> = { revision: asset.revision + 1, updatedAt: new Date() };
    if (data.action === "share") patch.visibility = "shared";
    if (data.action === "hide") patch.visibility = "internal";
    if (data.action === "archive") { patch.archivedAt = new Date(); patch.visibility = "internal"; }
    if (data.action === "restore") { patch.archivedAt = null; patch.visibility = "internal"; }
    if (data.action === "rename") { if (!data.label) throw new FileError("Enter a file name."); patch.label = data.label; patch.note = data.note ?? asset.note; }
    const [saved] = await tx.update(managedAsset).set(patch).where(eq(managedAsset.id, id)).returning();
    await writePlatformEvent(tx, { actorId: actor.id, projectId: asset.projectId, villaId: asset.villaId, action: `file.${data.action}`, targetId: id, summary: `${data.action === "share" ? "Shared" : "Updated"} ${saved.label}`, notify: data.action === "share" && asset.visibility !== "shared", pmSafe: asset.kind === "photo", dedupeKey: data.action === "share" ? `file:shared:${asset.id}:r${asset.revision}` : undefined });
    return publicAsset(saved);
  });
}

export async function listManagedFiles(scope: unknown, page = 0) {
  const data = scopeSchema.parse(scope); const actor = await requireActor();
  if (actor.role !== "pm" && actor.role !== "developer") throw new FileError("This file list is for the project team only.", 403);
  await assertScope(db, actor, data);
  const offset = z.number().int().min(0).max(200).parse(page) * 40;
  const rows = await db.select().from(managedAsset).where(and(
    eq(managedAsset.projectId, data.projectId), gt(managedAsset.activeVersion, 0),
    data.villaId ? or(eq(managedAsset.villaId, data.villaId), isNull(managedAsset.villaId)) : undefined,
    actor.role === "pm" ? eq(managedAsset.kind, "photo") : undefined,
  )).orderBy(desc(managedAsset.createdAt), desc(managedAsset.id)).limit(41).offset(offset);
  let legacyLinks: { id: string; label: string; note: string; kind: string; url: string | null; sourceUrl: string; villaCode: string }[] = [];
  let legacyCount = 0;
  if (actor.role === "developer") {
    const legacyWhere = and(eq(villa.projectId, data.projectId), data.villaId ? eq(legacyFile.villaId, data.villaId) : undefined);
    const [total] = await db.select({ total: count() }).from(legacyFile).innerJoin(villa, eq(villa.id, legacyFile.villaId)).where(legacyWhere);
    legacyCount = total?.total ?? 0;
    const legacyRows = await db.select({ id: legacyFile.id, label: legacyFile.label, note: legacyFile.note, kind: legacyFile.kind, url: legacyFile.url, villaCode: villa.code }).from(legacyFile).innerJoin(villa, eq(villa.id, legacyFile.villaId)).where(legacyWhere).orderBy(desc(legacyFile.createdAt), desc(legacyFile.id)).limit(50);
    legacyLinks = legacyRows.map(row => ({ ...row, label: row.label || "Untitled legacy file", note: row.note || "", sourceUrl: row.url.slice(0, 2048), url: /^https?:\/\//i.test(row.url) ? safeDocumentUrl(row.url) : null }));
  }
  return { files: rows.slice(0, 40).map(publicAsset), hasMore: rows.length > 40, page, storageReady: storageConfigured(), legacyLinks, legacyCount };
}

/** Every read rechecks current account status/role and current ownership. */
async function buyerScope(accountId: string, villaId: string) {
  const rows = await db.select({ projectId: villa.projectId }).from(account)
    .innerJoin(buyer, eq(buyer.accountId, account.id)).innerJoin(buyerVilla, eq(buyerVilla.buyerId, buyer.id))
    .innerJoin(villa, eq(villa.id, buyerVilla.villaId))
    .where(and(eq(account.id, accountId), eq(account.role, "buyer"), eq(villa.id, villaId)));
  if (!rows.length) throw new FileError("File not found.", 404);
  return rows[0];
}
export async function getManagedFilesForBuyer(accountId: string, villaId: string) {
  const scope = await buyerScope(accountId, villaId);
  const rows = await db.select().from(managedAsset).where(and(
    eq(managedAsset.projectId, scope.projectId), or(eq(managedAsset.villaId, villaId), isNull(managedAsset.villaId)),
    eq(managedAsset.visibility, "shared"), isNull(managedAsset.archivedAt), gt(managedAsset.activeVersion, 0),
  )).orderBy(desc(managedAsset.updatedAt)).limit(500);
  return rows.map(asset => ({ id: asset.id, label: asset.label, note: asset.note, kind: asset.kind, url: `/api/files/${asset.id}`, createdAt: asset.updatedAt }));
}

export async function downloadManagedFile(id: string) {
  z.uuid().parse(id);
  const currentAccount = await requireActor(); const accountId = currentAccount.id;
  const [asset] = await db.select().from(managedAsset).where(eq(managedAsset.id, id));
  if (!asset || asset.archivedAt || !asset.activeVersion) throw new FileError("File not found.", 404);
  if (currentAccount.role === "buyer") {
    if (asset.visibility !== "shared") throw new FileError("File not found.", 404);
    if (asset.villaId) await buyerScope(accountId, asset.villaId);
    else {
      const owned = await db.select({ id: villa.id }).from(buyer).innerJoin(buyerVilla, eq(buyerVilla.buyerId, buyer.id)).innerJoin(villa, eq(villa.id, buyerVilla.villaId)).where(and(eq(buyer.accountId, accountId), eq(villa.projectId, asset.projectId))).limit(1);
      if (!owned.length) throw new FileError("File not found.", 404);
    }
  } else {
    assertPhotoPermission(currentAccount.role, asset.kind);
    await assertScope(db, currentAccount, assetScope(asset));
  }
  const [version] = await db.select().from(assetVersion).where(and(eq(assetVersion.assetId, id), eq(assetVersion.sequence, asset.activeVersion)));
  if (!version) throw new FileError("File not found.", 404);
  const stream = await readStoredFile(version.storagePath);
  return new Response(stream, { headers: { ...privateFileHeaders(version.contentType, version.fileName, asset.kind === "photo"), "Content-Length": String(version.byteSize) } });
}
