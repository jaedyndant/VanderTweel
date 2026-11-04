import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";

const login = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: login.id } })) }));

import { db } from "../../src/db/client";
import { account, auditLog, buyer, buyerVilla, project, projectManager, pmProject, update as legacyUpdate, villa } from "../../src/db/schema";
import { assetVersion, managedAsset } from "../../src/db/files-schema";
import { eventRecipient, mailOutbox, messageAsset, platformEvent, teamMessage } from "../../src/db/events-schema";
import { getBuyerMessages, getBuyerNotifications, getCommunication, getOfficeMessageSummaries, markNotificationRead, publishTeamMessage } from "../../src/lib/platform-communication";
import { writePlatformEvent } from "../../src/lib/platform-events";

const marker = randomUUID().slice(0, 8);
const developerId = randomUUID();
const pmAccountId = randomUUID();
const buyerAccountA = randomUUID();
const buyerAccountB = randomUUID();
const buyerAccountC = randomUUID();
const buyerA = randomUUID();
const buyerB = randomUUID();
const buyerC = randomUUID();
const managerId = randomUUID();
const projectA = randomUUID();
const projectB = randomUUID();
const villaA = randomUUID();
const villaA2 = randomUUID();
const villaB = randomUUID();
const paginationVilla = randomUUID();
const photoProject = randomUUID();
const photoVilla = randomUUID();
const photoOtherVilla = randomUUID();
const photoOtherProject = randomUUID();
const photoInternal = randomUUID();
const photoUnfinished = randomUUID();
const photoArchived = randomUUID();
const assetIds = [photoProject, photoVilla, photoOtherVilla, photoOtherProject, photoInternal, photoUnfinished, photoArchived];
const allAccountIds = [developerId, pmAccountId, buyerAccountA, buyerAccountB, buyerAccountC];
let isolatedDatabaseVerified = false;

beforeAll(async () => {
  const connection = new URL(process.env.DATABASE_URL ?? "postgres://invalid");
  if (process.env.VDT_LOCAL_TEST !== "1" || !["127.0.0.1", "localhost"].includes(connection.hostname) || connection.port !== "55439") throw new Error("Communication integration tests require the isolated local database on port 55439.");
  isolatedDatabaseVerified = true;
  await db.insert(account).values(allAccountIds.map((id, index) => ({ id, email: `communication-${marker}-${index}@local.test`, role: index === 0 ? "developer" : index === 1 ? "pm" : "buyer", displayName: `Fixture person ${index}` })));
  await db.insert(project).values([{ id: projectA, name: "Communication A", slug: `communication-a-${marker}` }, { id: projectB, name: "Communication B", slug: `communication-b-${marker}` }]);
  await db.insert(villa).values([{ id: villaA, projectId: projectA, code: `COM-${marker}-A` }, { id: villaA2, projectId: projectA, code: `COM-${marker}-A2` }, { id: villaB, projectId: projectB, code: `COM-${marker}-B` }]);
  await db.insert(buyer).values([{ id: buyerA, accountId: buyerAccountA, name: "Buyer A" }, { id: buyerB, accountId: buyerAccountB, name: "Buyer B" }, { id: buyerC, accountId: buyerAccountC, name: "Buyer C" }]);
  await db.insert(buyerVilla).values([{ buyerId: buyerA, villaId: villaA }, { buyerId: buyerA, villaId: villaA2 }, { buyerId: buyerB, villaId: villaB }, { buyerId: buyerC, villaId: villaA }]);
  await db.insert(projectManager).values({ id: managerId, accountId: pmAccountId });
  await db.insert(pmProject).values({ pmId: managerId, projectId: projectA });
  await db.insert(managedAsset).values([
    { id: photoProject, projectId: projectA, label: "Shared project photo", kind: "photo", visibility: "shared", activeVersion: 1, createdBy: developerId },
    { id: photoVilla, projectId: projectA, villaId: villaA, label: "Shared villa photo", kind: "photo", visibility: "shared", activeVersion: 1, createdBy: developerId },
    { id: photoOtherVilla, projectId: projectA, villaId: villaA2, label: "Other villa", kind: "photo", visibility: "shared", activeVersion: 1, createdBy: developerId },
    { id: photoOtherProject, projectId: projectB, villaId: villaB, label: "Other project", kind: "photo", visibility: "shared", activeVersion: 1, createdBy: developerId },
    { id: photoInternal, projectId: projectA, villaId: villaA, label: "Internal photo", kind: "photo", visibility: "internal", activeVersion: 1, createdBy: developerId },
    { id: photoUnfinished, projectId: projectA, label: "Not uploaded", kind: "photo", visibility: "shared", activeVersion: 0, createdBy: developerId },
    { id: photoArchived, projectId: projectA, label: "Archived", kind: "photo", visibility: "shared", activeVersion: 1, archivedAt: new Date(), createdBy: developerId },
  ]);
  await db.insert(assetVersion).values(assetIds.filter((id) => id !== photoUnfinished).map((assetId) => ({ assetId, sequence: 1, storagePath: `communication-fixture/${marker}/${assetId}.jpg`, fileName: "fixture.jpg", contentType: "image/jpeg", byteSize: 128, uploadedBy: developerId })));
  login.id = developerId;
});

afterAll(async () => {
  if (!isolatedDatabaseVerified) return;
  await db.transaction(async (tx) => {
    const events = await tx.select({ id: platformEvent.id }).from(platformEvent).where(inArray(platformEvent.projectId, [projectA, projectB]));
    if (events.length) {
      await tx.delete(mailOutbox).where(inArray(mailOutbox.eventId, events.map((event) => event.id)));
      await tx.delete(eventRecipient).where(inArray(eventRecipient.eventId, events.map((event) => event.id)));
    }
    await tx.delete(platformEvent).where(inArray(platformEvent.projectId, [projectA, projectB]));
    await tx.delete(auditLog).where(inArray(auditLog.actorAccountId, [developerId, pmAccountId]));
    const messages = await tx.select({ id: teamMessage.id }).from(teamMessage).where(inArray(teamMessage.projectId, [projectA, projectB]));
    if (messages.length) await tx.delete(messageAsset).where(inArray(messageAsset.messageId, messages.map((message) => message.id)));
    await tx.delete(teamMessage).where(inArray(teamMessage.projectId, [projectA, projectB]));
    await tx.delete(legacyUpdate).where(inArray(legacyUpdate.villaId, [villaA, villaA2, villaB, paginationVilla]));
    await tx.delete(assetVersion).where(inArray(assetVersion.assetId, assetIds));
    await tx.delete(managedAsset).where(inArray(managedAsset.id, assetIds));
    await tx.delete(buyerVilla).where(inArray(buyerVilla.buyerId, [buyerA, buyerB, buyerC]));
    await tx.delete(buyer).where(inArray(buyer.id, [buyerA, buyerB, buyerC]));
    await tx.delete(pmProject).where(eq(pmProject.pmId, managerId));
    await tx.delete(projectManager).where(eq(projectManager.id, managerId));
    await tx.delete(villa).where(inArray(villa.id, [villaA, villaA2, villaB, paginationVilla]));
    await tx.delete(project).where(inArray(project.id, [projectA, projectB]));
    await tx.delete(account).where(inArray(account.id, allAccountIds));
  });
});

const message = (overrides: Record<string, unknown> = {}) => ({ id: randomUUID(), projectId: projectA, title: "Construction update", body: "Foundation work completed.", category: "Construction", assetIds: [], ...overrides });

describe("communication PostgreSQL integration", () => {
  it("project/villa messages stay in assigned buyer scope and deduplicate multi-villa recipients", async () => {
    login.id = developerId;
    const common = message({ assetIds: [photoProject] });
    const privateA = message({ villaId: villaA, title: "Villa A" });
    const privateA2 = message({ villaId: villaA2, title: "Villa A2" });
    const other = message({ projectId: projectB, villaId: villaB, title: "Other project" });
    for (const input of [common, privateA, privateA2, other]) await publishTeamMessage(input);
    const visible = await getBuyerMessages(buyerAccountA, villaA);
    expect(visible.map((row) => row.id)).toEqual(expect.arrayContaining([common.id, privateA.id]));
    expect(visible.map((row) => row.id)).not.toContain(privateA2.id);
    expect(visible.map((row) => row.id)).not.toContain(other.id);
    expect(await getBuyerMessages(buyerAccountA, villaB)).toEqual([]);
    const [event] = await db.select().from(platformEvent).where(eq(platformEvent.targetId, common.id));
    const recipients = await db.select().from(eventRecipient).where(eq(eventRecipient.eventId, event.id));
    expect(recipients.map((row) => row.buyerId).sort()).toEqual([buyerA, buyerC].sort());
    const deliveries = await db.select().from(mailOutbox).where(eq(mailOutbox.eventId, event.id));
    expect(deliveries).toHaveLength(2);
    expect(new Set(deliveries.map((row) => row.recipientAccountId))).toEqual(new Set([buyerAccountA, buyerAccountC]));
  });

  it("buyers cannot publish and PMs cannot publish Payment/Paperwork or target another project", async () => {
    login.id = buyerAccountA;
    await expect(publishTeamMessage(message())).rejects.toMatchObject({ status: 403 });
    login.id = pmAccountId;
    for (const category of ["Payment", "Paperwork"]) await expect(publishTeamMessage(message({ category }))).rejects.toMatchObject({ status: 403 });
    await expect(publishTeamMessage(message({ projectId: projectB }))).rejects.toMatchObject({ status: 403 });
    await expect(publishTeamMessage(message({ villaId: villaB }))).rejects.toMatchObject({ status: 403 });
    const permitted = message({ villaId: villaA, title: "PM construction" });
    expect(await publishTeamMessage(permitted)).toEqual({ id: permitted.id });
  });

  it("only finalized shared unarchived photos in the selected scope can be attached", async () => {
    login.id = developerId;
    for (const assetId of [photoInternal, photoOtherVilla, photoOtherProject, photoUnfinished, photoArchived, randomUUID()]) {
      const rejected = message({ villaId: villaA, assetIds: [assetId] });
      await expect(publishTeamMessage(rejected)).rejects.toMatchObject({ status: 400 });
      expect(await db.select().from(teamMessage).where(eq(teamMessage.id, rejected.id))).toHaveLength(0);
    }
    await expect(publishTeamMessage(message({ assetIds: [photoVilla] }))).rejects.toMatchObject({ status: 400 });
    const accepted = message({ villaId: villaA, assetIds: [photoProject, photoVilla, photoVilla] });
    await publishTeamMessage(accepted);
    const ownerView = (await getBuyerMessages(buyerAccountA, villaA)).find((row) => row.id === accepted.id)!;
    expect(ownerView.photos.map((row) => row.id).sort()).toEqual([photoProject, photoVilla].sort());
    expect(await db.select().from(messageAsset).where(eq(messageAsset.messageId, accepted.id))).toHaveLength(2);
    await db.update(managedAsset).set({ visibility: "internal" }).where(eq(managedAsset.id, photoVilla));
    const redactedView = (await getBuyerMessages(buyerAccountA, villaA)).find((row) => row.id === accepted.id)!;
    expect(redactedView.photos.map((row) => row.id)).toEqual([photoProject]);
    await db.update(managedAsset).set({ visibility: "shared" }).where(eq(managedAsset.id, photoVilla));
  });

  it("photo pickers exclude unfinished and out-of-scope records, and PM activity omits financial events/delivery details", async () => {
    login.id = developerId;
    const payment = message({ title: "Payment update", category: "Payment" });
    await publishTeamMessage(payment);
    const developerView = await getCommunication({ projectId: projectA });
    expect(developerView.photos.map((row) => row.id)).toEqual([photoProject]);
    login.id = pmAccountId;
    const pmView = await getCommunication({ projectId: projectA });
    expect(pmView.activity.some((row) => row.targetId === payment.id)).toBe(false);
    expect(pmView.activity.every((row) => row.pmSafe && row.delivery === undefined)).toBe(true);
    await expect(getCommunication({ projectId: projectB })).rejects.toMatchObject({ status: 403 });
  });

  it("notification reads belong to one recipient and cannot acknowledge another owner's notification", async () => {
    login.id = developerId;
    const input = message({ villaId: villaA, title: "Read ownership test" });
    await publishTeamMessage(input);
    const [event] = await db.select().from(platformEvent).where(eq(platformEvent.targetId, input.id));
    login.id = buyerAccountB;
    await expect(markNotificationRead(event.id)).rejects.toMatchObject({ status: 403 });
    expect((await getBuyerNotifications()).notifications.some((row) => row.id === event.id)).toBe(false);
    login.id = buyerAccountA;
    expect((await getBuyerNotifications()).notifications.filter((row) => row.id === event.id)).toHaveLength(1);
    await markNotificationRead(event.id);
    const recipients = await db.select().from(eventRecipient).where(eq(eventRecipient.eventId, event.id));
    expect(recipients.find((row) => row.buyerId === buyerA)?.readAt).toBeInstanceOf(Date);
    expect(recipients.find((row) => row.buyerId === buyerC)?.readAt).toBeNull();
  });

  it("concurrent identical message requests return the same result and persist only one event/mail per owner", async () => {
    login.id = developerId;
    const input = message({ villaId: villaA, title: "Concurrent publication", assetIds: [photoVilla] });
    const outcomes = await Promise.allSettled([publishTeamMessage(input), publishTeamMessage(input), publishTeamMessage(input)]);
    expect(outcomes.every((outcome) => outcome.status === "fulfilled" && outcome.value.id === input.id)).toBe(true);
    expect(await db.select().from(teamMessage).where(eq(teamMessage.id, input.id))).toHaveLength(1);
    const events = await db.select().from(platformEvent).where(eq(platformEvent.targetId, input.id));
    expect(events).toHaveLength(1);
    expect(await db.select().from(mailOutbox).where(eq(mailOutbox.eventId, events[0].id))).toHaveLength(2);
  });

  it("replaying a message ID with changed category or attachments is rejected", async () => {
    login.id = developerId;
    const input = message({ villaId: villaA, title: "Immutable request payload", assetIds: [photoVilla] });
    await publishTeamMessage(input);
    await expect(publishTeamMessage({ ...input, category: "Payment" })).rejects.toMatchObject({ status: 409 });
    await expect(publishTeamMessage({ ...input, assetIds: [photoProject] })).rejects.toMatchObject({ status: 409 });
  });

  for (const target of ["audit_log", "mail_outbox"] as const) it(`rolls back event/recipients/delivery when the ${target} insert fails in PostgreSQL`, async () => {
    const targetId = randomUUID();
    const beforeMail = await db.select({ id: mailOutbox.id }).from(mailOutbox).where(inArray(mailOutbox.recipientAccountId, [buyerAccountA, buyerAccountC]));
    const beforeRecipients = await db.select().from(eventRecipient).where(inArray(eventRecipient.buyerId, [buyerA, buyerC]));
    await expect(db.transaction(async (tx) => {
      // A transaction-local temp relation shadows just this connection's table
      // and rejects INSERTs. No permanent schema change, global trigger or DB mock.
      await tx.execute(sql.raw(`CREATE TEMP TABLE ${target} (LIKE public.${target} INCLUDING ALL) ON COMMIT DROP`));
      await tx.execute(sql.raw(`ALTER TABLE pg_temp.${target} ADD CONSTRAINT synthetic_insert_failure CHECK (false)`));
      await writePlatformEvent(tx, { actorId: developerId, projectId: projectA, villaId: villaA, action: "test.rollback", targetId, summary: "Synthetic rollback proof", notify: true, pmSafe: true, dedupeKey: `rollback:${targetId}` });
    })).rejects.toThrow();
    expect(await db.select().from(platformEvent).where(eq(platformEvent.targetId, targetId))).toHaveLength(0);
    expect(await db.select().from(auditLog).where(eq(auditLog.targetId, targetId))).toHaveLength(0);
    expect(await db.select({ id: mailOutbox.id }).from(mailOutbox).where(inArray(mailOutbox.recipientAccountId, [buyerAccountA, buyerAccountC]))).toHaveLength(beforeMail.length);
    expect(await db.select().from(eventRecipient).where(inArray(eventRecipient.buyerId, [buyerA, buyerC]))).toHaveLength(beforeRecipients.length);
  });

  it("paginates legacy and new buyer messages together with a stable tie-breaker, one-row lookahead and no scope leak", async () => {
    await db.insert(villa).values({ id: paginationVilla, projectId: projectB, code: `COM-${marker}-PG` });
    await db.insert(buyerVilla).values({ buyerId: buyerB, villaId: paginationVilla });
    const timestamp = new Date("2026-09-01T12:00:00.000Z");
    const legacyIds: string[] = Array.from({ length: 33 }, () => randomUUID());
    const currentIds: string[] = Array.from({ length: 32 }, () => randomUUID());
    await db.insert(legacyUpdate).values(legacyIds.map((id) => ({ id, villaId: paginationVilla, authorId: developerId, title: null, body: "Legacy villa history", category: null, authorRoleLabel: null, createdAt: timestamp })));
    await db.insert(teamMessage).values(currentIds.map((id, index) => ({ id, projectId: projectB, villaId: index % 2 ? paginationVilla : null, authorId: developerId, authorLabel: "Named developer", title: "Current project history", body: "Current history", category: "Construction", createdAt: timestamp })));
    const privateLegacy = randomUUID();
    const privateCurrent = randomUUID();
    await db.insert(legacyUpdate).values({ id: privateLegacy, villaId: villaB, authorId: developerId, body: "Another villa's legacy history", createdAt: timestamp });
    await db.insert(teamMessage).values({ id: privateCurrent, projectId: projectB, villaId: villaB, authorId: developerId, authorLabel: "Named developer", title: "Other villa only", body: "Must not be included", category: "Construction", createdAt: timestamp });

    const first = await getBuyerMessages(buyerAccountB, paginationVilla, 0);
    const repeatedFirst = await getBuyerMessages(buyerAccountB, paginationVilla, 0);
    const second = await getBuyerMessages(buyerAccountB, paginationVilla, 1);
    const third = await getBuyerMessages(buyerAccountB, paginationVilla, 2);
    const expectedIds = [...legacyIds, ...currentIds].sort().reverse();
    expect(first).toHaveLength(31);
    expect(second).toHaveLength(31);
    expect(third).toHaveLength(5);
    expect(first.map((row) => row.id)).toEqual(expectedIds.slice(0, 31));
    expect(repeatedFirst.map((row) => row.id)).toEqual(first.map((row) => row.id));
    expect(second.map((row) => row.id)).toEqual(expectedIds.slice(30, 61));
    expect(third.map((row) => row.id)).toEqual(expectedIds.slice(60));
    // The 31st row is a has-more sentinel, not a rendered duplicate. The
    // adapter renders 30 rows, then starts the next page at offset 30.
    const rendered = [...first.slice(0, 30), ...second.slice(0, 30), ...third];
    expect(rendered.map((row) => row.id)).toEqual(expectedIds);
    expect(new Set(rendered.map((row) => row.id)).size).toBe(65);
    expect(rendered.some((row) => row.id === privateLegacy || row.id === privateCurrent)).toBe(false);
    const legacy = rendered.find((row) => legacyIds.includes(row.id))!;
    expect(legacy).toMatchObject({ title: "Site update", category: "Construction", authorRoleLabel: "Site team", photos: [] });
    expect(await getBuyerMessages(buyerAccountA, paginationVilla, 0)).toEqual([]);
    expect(await getBuyerMessages(buyerAccountB, paginationVilla, 3)).toEqual([]);
  });

  it("publishes a maximum-valid 200-character title and 10000-character body without truncating its event", async () => {
    login.id = developerId;
    const input = message({ villaId: villaA, title: "T".repeat(200), body: "B".repeat(10_000) });
    expect(await publishTeamMessage(input)).toEqual({ id: input.id });
    const [saved] = await db.select().from(teamMessage).where(eq(teamMessage.id, input.id));
    expect(saved.title).toHaveLength(200);
    expect(saved.body).toHaveLength(10_000);
    const [event] = await db.select().from(platformEvent).where(eq(platformEvent.targetId, input.id));
    expect(event.summary).toBe(`${input.title}\n${input.body}`);
    expect(event.summary).toHaveLength(10_201);
    expect(await db.select().from(eventRecipient).where(eq(eventRecipient.eventId, event.id))).toHaveLength(2);
    const deliveries = await db.select().from(mailOutbox).where(eq(mailOutbox.eventId, event.id));
    expect(deliveries).toHaveLength(2);
    expect(deliveries.every((row) => row.body.includes(event.summary))).toBe(true);
  });

  it("office message summaries exclude financial/paperwork messages for PMs and preserve the real author label", async () => {
    login.id = pmAccountId;
    const construction = message({ villaId: villaA, title: "Named manager construction" });
    await publishTeamMessage(construction);
    login.id = developerId;
    const financial = message({ villaId: villaA, title: "Financial summary", category: "Payment" });
    const paperwork = message({ villaId: villaA, title: "Paperwork summary", category: "Paperwork" });
    const otherVilla = message({ villaId: villaA2, title: "Another villa construction" });
    for (const input of [financial, paperwork, otherVilla]) await publishTeamMessage(input);
    const developerRows = await getOfficeMessageSummaries([projectA], villaA);
    expect(developerRows.map((row) => row.id)).toEqual(expect.arrayContaining([construction.id, financial.id, paperwork.id]));
    expect(developerRows.some((row) => row.id === otherVilla.id)).toBe(false);
    login.id = pmAccountId;
    const managerRows = await getOfficeMessageSummaries([projectA], villaA);
    expect(managerRows.every((row) => row.category === "Construction")).toBe(true);
    expect(managerRows.some((row) => [financial.id, paperwork.id, otherVilla.id].some((id) => id === row.id))).toBe(false);
    expect(managerRows.find((row) => row.id === construction.id)).toMatchObject({ authorRoleLabel: "Fixture person 1", villaId: villaA });
    await expect(getOfficeMessageSummaries([projectA, projectB])).rejects.toMatchObject({ status: 403 });
    login.id = buyerAccountA;
    expect(await getOfficeMessageSummaries([projectA], villaA)).toEqual([]);
  });
});
