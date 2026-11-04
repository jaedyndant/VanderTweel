import { and, desc, eq, inArray, isNull, or, sql, gt } from "drizzle-orm";
import { z } from "zod";
import { unionAll } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { account, buyer, buyerVilla, villa, update } from "@/db/schema";
import { managedAsset } from "@/db/files-schema";
import { teamMessage, messageAsset, platformEvent, eventRecipient, mailOutbox } from "@/db/events-schema";
import { AccessError, assertScope, requireActor } from "@/lib/platform-access";
import { writePlatformEvent } from "@/lib/platform-events";

const scopeSchema = z.object({ projectId: z.uuid(), villaId: z.uuid().optional(), page: z.coerce.number().int().min(0).max(1000).default(0) });
const messageSchema = z.object({ id: z.uuid(), projectId: z.uuid(), villaId: z.uuid().optional(), title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(10_000), category: z.enum(["Construction", "Payment", "Paperwork"]), assetIds: z.array(z.uuid()).max(12).default([]) });
export async function publishTeamMessage(input: unknown) {
  const data = messageSchema.parse(input);
  const actor = await requireActor();
  if (actor.role === "buyer" || (actor.role === "pm" && data.category !== "Construction")) throw new AccessError();
  return db.transaction(async tx => {
    await assertScope(tx, actor, data);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`message:${data.id}`}, 0))`);
    const [existing] = await tx.select().from(teamMessage).where(eq(teamMessage.id, data.id));
    if (existing) {
      if (existing.authorId !== actor.id || existing.projectId !== data.projectId || existing.villaId !== (data.villaId ?? null) || existing.title !== data.title || existing.body !== data.body || existing.category !== data.category) throw new AccessError("This submission has changed. Reload before posting.", 409);
      const links = await tx.select({id: messageAsset.assetId}).from(messageAsset).where(eq(messageAsset.messageId, data.id));
      if (JSON.stringify(links.map(l=>l.id).sort()) !== JSON.stringify([...new Set(data.assetIds)].sort())) throw new AccessError("This submission has changed. Reload before posting.", 409);
      return { id: existing.id };
    }
    const ids = [...new Set(data.assetIds)];
    const assets = ids.length ? await tx.select().from(managedAsset).where(inArray(managedAsset.id, ids)).for("share") : [];
    if (assets.length !== ids.length || assets.some(a => a.kind !== "photo" || a.visibility !== "shared" || a.archivedAt || !a.activeVersion || a.projectId !== data.projectId || (a.villaId && a.villaId !== data.villaId))) throw new AccessError("Select published photos from this project or villa.", 400);
    const [created] = await tx.insert(teamMessage).values({ ...data, authorId: actor.id, authorLabel: actor.displayName || (actor.role === "pm" ? "Project manager" : "Development team") }).onConflictDoNothing().returning();
    if (!created) throw new AccessError("This update was already submitted. Refresh the page.", 409);
    if (ids.length) await tx.insert(messageAsset).values(ids.map(assetId => ({ messageId: data.id, assetId })));
    await writePlatformEvent(tx, { actorId: actor.id, projectId: data.projectId, villaId: data.villaId, action: "update.published", targetId: data.id, summary: `${data.title}\n${data.body}`, notify: true, pmSafe: data.category === "Construction", dedupeKey: `message:${data.id}`, link: `/koper/updates${data.villaId ? `?villa=${data.villaId}` : ""}` });
    return { id: created.id };
  });
}
export async function getCommunication(input: unknown) {
  const scope = scopeSchema.parse(input);
  const actor = await requireActor();
  if (actor.role === "buyer") throw new AccessError();
  await assertScope(db, actor, scope);
  const filter = and(eq(platformEvent.projectId, scope.projectId), scope.villaId ? or(eq(platformEvent.villaId, scope.villaId), isNull(platformEvent.villaId)) : undefined, actor.role === "pm" ? eq(platformEvent.pmSafe, true) : undefined);
  const activity = await db.select().from(platformEvent).where(filter).orderBy(desc(platformEvent.createdAt), desc(platformEvent.id)).limit(31).offset(scope.page * 30);
  const deliveries = actor.role === "developer" && activity.length ? await db.select({ eventId: mailOutbox.eventId, status: mailOutbox.status }).from(mailOutbox).where(inArray(mailOutbox.eventId, activity.map(e => e.id))) : [];
  const photos = await db.select({ id: managedAsset.id, label: managedAsset.label, villaId: managedAsset.villaId }).from(managedAsset).where(and(eq(managedAsset.projectId, scope.projectId), eq(managedAsset.kind, "photo"), eq(managedAsset.visibility, "shared"), isNull(managedAsset.archivedAt), gt(managedAsset.activeVersion, 0), scope.villaId ? or(isNull(managedAsset.villaId), eq(managedAsset.villaId, scope.villaId)) : isNull(managedAsset.villaId))).limit(100);
  return { activity: activity.slice(0, 30).map(e => ({ ...e, delivery: actor.role === "developer" ? deliveries.filter(d => d.eventId === e.id).map(d => d.status) : undefined })), hasMore: activity.length > 30, photos };
}
export async function getBuyerMessages(accountId: string, villaId: string, page=0) {
  const [row] = await db.select({ projectId: villa.projectId }).from(buyer).innerJoin(account, eq(account.id, buyer.accountId)).innerJoin(buyerVilla, eq(buyerVilla.buyerId, buyer.id)).innerJoin(villa, eq(villa.id, buyerVilla.villaId)).where(and(eq(account.id, accountId), eq(account.role, "buyer"), eq(villa.id, villaId))).limit(1);
  if (!row) return [];
  const selection = {id:teamMessage.id,title:teamMessage.title,body:teamMessage.body,category:teamMessage.category,authorLabel:teamMessage.authorLabel,createdAt:teamMessage.createdAt};
  const current = db.select(selection).from(teamMessage).where(and(eq(teamMessage.projectId,row.projectId),or(eq(teamMessage.villaId,villaId),isNull(teamMessage.villaId))));
  const legacy = db.select({id:update.id,title:sql<string>`coalesce(${update.title}, 'Site update')`,body:update.body,category:sql<string>`coalesce(${update.category}, 'Construction')`,authorLabel:sql<string>`coalesce(${update.authorRoleLabel}, 'Site team')`,createdAt:update.createdAt}).from(update).where(eq(update.villaId,villaId));
  const messages = await unionAll(current,legacy).orderBy(desc(sql`created_at`),desc(sql`id`)).limit(31).offset(page*30);
  if (!messages.length) return [];
  const photos = await db.select({ messageId: messageAsset.messageId, id: managedAsset.id, label: managedAsset.label }).from(messageAsset).innerJoin(managedAsset, eq(managedAsset.id, messageAsset.assetId)).where(and(inArray(messageAsset.messageId, messages.map(m => m.id)), eq(managedAsset.visibility, "shared"), isNull(managedAsset.archivedAt), eq(managedAsset.kind, "photo"), eq(managedAsset.projectId, row.projectId), or(eq(managedAsset.villaId, villaId), isNull(managedAsset.villaId))));
  return messages.map(m => ({ id: m.id, title: m.title, body: m.body, category: m.category, authorRoleLabel: m.authorLabel, createdAt: m.createdAt, photos: photos.filter(p => p.messageId === m.id).map(p => ({ id: p.id, label: p.label, url: `/api/files/${p.id}` })) }));
}
export async function getBuyerNotifications(page = 0) {
  const actor = await requireActor();
  if (actor.role !== "buyer") throw new AccessError();
  const allowed = await db.select({ buyerId: buyer.id, villaId: villa.id, projectId: villa.projectId }).from(buyer).innerJoin(buyerVilla, eq(buyerVilla.buyerId, buyer.id)).innerJoin(villa, eq(villa.id, buyerVilla.villaId)).where(eq(buyer.accountId, actor.id));
  if (!allowed.length) return { notifications: [], hasMore: false };
  const scope = or(...allowed.map(a => and(eq(platformEvent.projectId, a.projectId), or(isNull(platformEvent.villaId), eq(platformEvent.villaId, a.villaId)))));
  const rows = await db.select({ id: platformEvent.id, summary: platformEvent.summary, link: platformEvent.link, createdAt: platformEvent.createdAt, readAt: eventRecipient.readAt }).from(eventRecipient).innerJoin(platformEvent, eq(platformEvent.id, eventRecipient.eventId)).where(and(eq(eventRecipient.buyerId, allowed[0].buyerId), scope)).orderBy(desc(platformEvent.createdAt), desc(platformEvent.id)).limit(31).offset(page * 30);
  return { notifications: rows.slice(0,30), hasMore: rows.length > 30 };
}
export async function markNotificationRead(id: string) {
  z.uuid().parse(id);
  const actor = await requireActor();
  if (actor.role !== "buyer") throw new AccessError();
  const [recipient] = await db.select({ buyerId: buyer.id, projectId: platformEvent.projectId, villaId: platformEvent.villaId }).from(eventRecipient).innerJoin(buyer, eq(buyer.id, eventRecipient.buyerId)).innerJoin(platformEvent, eq(platformEvent.id, eventRecipient.eventId)).where(and(eq(buyer.accountId, actor.id), eq(eventRecipient.eventId, id)));
  if (!recipient) throw new AccessError();
  await assertScope(db, actor, recipient);
  await db.update(eventRecipient).set({ readAt: new Date() }).where(and(eq(eventRecipient.eventId, id), eq(eventRecipient.buyerId, recipient.buyerId)));
}

export async function getOfficeMessageSummaries(projectIds: string[], selectedVillaId?: string) {
  const actor = await requireActor();
  if (actor.role === 'buyer' || !projectIds.length) return [];
  for (const projectId of projectIds) await assertScope(db, actor, { projectId });
  const rows=await db.select({id:teamMessage.id,projectId:teamMessage.projectId,villaId:teamMessage.villaId,villaCode:villa.code,title:teamMessage.title,body:teamMessage.body,category:teamMessage.category,authorRoleLabel:teamMessage.authorLabel,createdAt:teamMessage.createdAt}).from(teamMessage).leftJoin(villa,eq(villa.id,teamMessage.villaId)).where(and(inArray(teamMessage.projectId,projectIds),selectedVillaId?or(eq(teamMessage.villaId,selectedVillaId),isNull(teamMessage.villaId)):undefined,actor.role==='pm'?eq(teamMessage.category,'Construction'):undefined)).orderBy(desc(teamMessage.createdAt),desc(teamMessage.id)).limit(100);
  return rows.map(row=>({...row,villaCode:row.villaCode??'All residences',createdAt:row.createdAt.toISOString()}));
}
