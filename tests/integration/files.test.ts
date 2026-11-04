import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, and } from "drizzle-orm";
const authState = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: authState.id } }) }));
import { db } from "@/db/client";
import { account, project, villa, buyer, buyerVilla, projectManager, pmProject, file as legacyFile } from "@/db/schema";
import { managedAsset, assetVersion } from "@/db/files-schema";
import { platformEvent, eventRecipient, mailOutbox } from "@/db/events-schema";
import { createUploadIntent, acceptLocalUpload, authorizeUploadToken, finalizeUpload, changeManagedFile, listManagedFiles, downloadManagedFile, getManagedFilesForBuyer } from "@/lib/files/service";

const ids = Object.fromEntries(["dev", "pm", "buyerA", "buyerB", "buyerA2", "projectA", "projectB", "villaA", "villaB", "villaA2", "profileA", "profileB", "profileA2", "pmProfile"].map(name => [name, randomUUID()]));
const pdf = new TextEncoder().encode("%PDF-1.4\nSynthetic local integration fixture\n%%EOF");
const jpeg = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 255, 217]);
let storageDirectory = "";
function as(name: keyof typeof ids) { authState.id = ids[name]; }
async function uploaded(kind: "doc" | "photo" = "doc", projectWide = false) {
  as("dev");
  const bytes = kind === "doc" ? pdf : jpeg;
  const intent = await createUploadIntent({ projectId: ids.projectA, villaId: projectWide ? undefined : ids.villaA, kind, label: `Synthetic ${kind}`, fileName: kind === "doc" ? "document.pdf" : "photo.jpg", contentType: kind === "doc" ? "application/pdf" : "image/jpeg", byteSize: bytes.length });
  await acceptLocalUpload(intent.intentId, bytes);
  return { intent, asset: await finalizeUpload(intent.assetId, intent.intentId), bytes };
}
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || !url.pathname.includes("vdt_completion_test")) throw new Error("File integration tests require the isolated local PostgreSQL fixture.");
  storageDirectory = await mkdtemp(join(tmpdir(), "vdt-file-integration-"));
  vi.stubEnv("FILE_STORAGE_DRIVER", "local"); vi.stubEnv("FILE_LOCAL_TEST", "true"); vi.stubEnv("FILE_LOCAL_DIRECTORY", storageDirectory);
  await db.insert(account).values(["dev", "pm", "buyerA", "buyerB", "buyerA2"].map(key => ({ id: ids[key], role: key === "dev" ? "developer" : key === "pm" ? "pm" : "buyer", email: `${ids[key]}@example.test` })));
  await db.insert(project).values([{ id: ids.projectA, name: "Files fixture A", slug: `files-${ids.projectA}` }, { id: ids.projectB, name: "Files fixture B", slug: `files-${ids.projectB}` }]);
  await db.insert(villa).values([{ id: ids.villaA, projectId: ids.projectA, code: `F-${ids.villaA.slice(0, 12)}` }, { id: ids.villaA2, projectId: ids.projectA, code: `F-${ids.villaA2.slice(0, 12)}` }, { id: ids.villaB, projectId: ids.projectB, code: `F-${ids.villaB.slice(0, 12)}` }]);
  await db.insert(buyer).values([{ id: ids.profileA, accountId: ids.buyerA, name: "Files Buyer A" }, { id: ids.profileA2, accountId: ids.buyerA2, name: "Files Buyer A2" }, { id: ids.profileB, accountId: ids.buyerB, name: "Files Buyer B" }]);
  await db.insert(buyerVilla).values([{ buyerId: ids.profileA, villaId: ids.villaA }, { buyerId: ids.profileA2, villaId: ids.villaA2 }, { buyerId: ids.profileB, villaId: ids.villaB }]);
  await db.insert(projectManager).values({ id: ids.pmProfile, accountId: ids.pm });
  await db.insert(pmProject).values({ pmId: ids.pmProfile, projectId: ids.projectA });
});
afterAll(async () => { vi.unstubAllEnvs(); if (storageDirectory) await rm(storageDirectory, { recursive: true, force: true }); });

describe("private files on real PostgreSQL + local storage", () => {
  it("keeps the legacy migration inventory developer-only, scoped and bounded to plain safe metadata", async () => {
    const sameId = randomUUID(); const otherId = randomUUID();
    await db.insert(legacyFile).values([
      { id: sameId, villaId: ids.villaA, uploadedBy: ids.dev, kind: "doc", label: "Legacy contract fixture", url: "javascript:alert(1)" },
      { id: otherId, villaId: ids.villaB, uploadedBy: ids.dev, kind: "doc", label: "Other project legacy", url: "https://example.invalid/old.pdf" },
    ]);
    as("dev"); const developer = await listManagedFiles({ projectId: ids.projectA, villaId: ids.villaA });
    expect(developer.legacyCount).toBe(1); expect(developer.legacyLinks).toHaveLength(1);
    expect(developer.legacyLinks[0].id).toBe(sameId); expect(developer.legacyLinks[0].url).toBeNull(); expect(developer.legacyLinks[0].sourceUrl).toBe("javascript:alert(1)");
    as("pm"); const pm = await listManagedFiles({ projectId: ids.projectA }); expect(pm.legacyLinks).toEqual([]); expect(pm.legacyCount).toBe(0);
    as("buyerA"); await expect(listManagedFiles({ projectId: ids.projectA })).rejects.toThrow("team only");
  });
  it("keeps new uploads internal, then shares only to the correct villa and sends one durable recipient event", async () => {
    const { asset } = await uploaded(); expect(asset.visibility).toBe("internal");
    as("buyerA"); await expect(downloadManagedFile(asset.id)).rejects.toThrow("not found");
    as("dev"); const shared = await changeManagedFile(asset.id, { action: "share", expectedRevision: asset.revision });
    as("buyerA"); const response = await downloadManagedFile(asset.id); expect(await response.text()).toContain("Synthetic local"); expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("content-disposition")).toContain("attachment");
    for (const other of ["buyerB", "buyerA2"]) { as(other); await expect(downloadManagedFile(asset.id)).rejects.toThrow("not found"); }
    as("buyerA"); await expect(listManagedFiles({ projectId: ids.projectA })).rejects.toThrow("team only");
    const events = await db.select().from(platformEvent).where(and(eq(platformEvent.targetId, asset.id), eq(platformEvent.action, "file.share")));
    expect(events).toHaveLength(1);
    expect(await db.select().from(eventRecipient).where(eq(eventRecipient.eventId, events[0].id))).toHaveLength(1);
    expect(await db.select().from(mailOutbox).where(eq(mailOutbox.eventId, events[0].id))).toHaveLength(1);
    expect(shared.visibility).toBe("shared");
  });
  it("shares project photos with all project buyers but no other project", async () => {
    const { asset } = await uploaded("photo", true); await changeManagedFile(asset.id, { action: "share", expectedRevision: asset.revision });
    for (const buyerKey of ["buyerA", "buyerA2"]) { as(buyerKey); const response = await downloadManagedFile(asset.id); expect(response.status).toBe(200); }
    as("buyerB"); await expect(downloadManagedFile(asset.id)).rejects.toThrow("not found");
    const visible = await getManagedFilesForBuyer(ids.buyerA2, ids.villaA2); expect(visible.some(file => file.id === asset.id)).toBe(true);
  });
  it("denies PM documents and wrong-project photos at API-service boundaries", async () => {
    const { asset } = await uploaded(); as("pm");
    await expect(downloadManagedFile(asset.id)).rejects.toThrow("not available");
    await expect(changeManagedFile(asset.id, { action: "share", expectedRevision: asset.revision })).rejects.toThrow("not available");
    await expect(createUploadIntent({ projectId: ids.projectA, villaId: ids.villaA, kind: "doc", label: "Forbidden", fileName: "doc.pdf", contentType: "application/pdf", byteSize: pdf.length })).rejects.toThrow("not available");
    await expect(createUploadIntent({ projectId: ids.projectB, villaId: ids.villaB, kind: "photo", label: "Wrong project", fileName: "photo.jpg", contentType: "image/jpeg", byteSize: jpeg.length })).rejects.toThrow();
    const listed = await listManagedFiles({ projectId: ids.projectA }); expect(listed.files.every(file => file.kind === "photo")).toBe(true);
  });
  it("binds token authorization to actor, generated path, and still-current assignment", async () => {
    as("pm"); const intent = await createUploadIntent({ projectId: ids.projectA, villaId: ids.villaA, kind: "photo", label: "Scope check", fileName: "photo.jpg", contentType: "image/jpeg", byteSize: jpeg.length });
    await expect(authorizeUploadToken(`${intent.pathname}-tampered`, intent.intentId)).rejects.toThrow("not found");
    as("dev"); await expect(authorizeUploadToken(intent.pathname, intent.intentId)).rejects.toThrow("not found");
    as("pm"); await db.delete(pmProject).where(eq(pmProject.pmId, ids.pmProfile));
    await expect(authorizeUploadToken(intent.pathname, intent.intentId)).rejects.toThrow();
    await db.insert(pmProject).values({ pmId: ids.pmProfile, projectId: ids.projectA });
  });
  it("serializes concurrent finalization into one immutable version and one audit event", async () => {
    as("dev"); const intent = await createUploadIntent({ projectId: ids.projectA, villaId: ids.villaA, kind: "doc", label: "Concurrent file", fileName: "doc.pdf", contentType: "application/pdf", byteSize: pdf.length });
    await acceptLocalUpload(intent.intentId, pdf);
    const [first, retry] = await Promise.all([finalizeUpload(intent.assetId, intent.intentId), finalizeUpload(intent.assetId, intent.intentId)]);
    expect(first.revision).toBe(retry.revision);
    expect(await db.select().from(assetVersion).where(eq(assetVersion.assetId, intent.assetId))).toHaveLength(1);
    expect(await db.select().from(platformEvent).where(eq(platformEvent.targetId, intent.assetId))).toHaveLength(1);
  });
  it("uses optimistic revision checks for concurrent sharing and archiving", async () => {
    const { asset } = await uploaded();
    const outcomes = await Promise.allSettled([changeManagedFile(asset.id, { action: "share", expectedRevision: asset.revision }), changeManagedFile(asset.id, { action: "archive", expectedRevision: asset.revision })]);
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(result => result.status === "rejected")).toHaveLength(1);
    const [saved] = await db.select().from(managedAsset).where(eq(managedAsset.id, asset.id)); expect(saved.revision).toBe(asset.revision + 1);
    as("dev"); if (!saved.archivedAt) await changeManagedFile(asset.id, { action: "archive", expectedRevision: saved.revision });
    as("buyerA"); await expect(downloadManagedFile(asset.id)).rejects.toThrow("not found");
  });
  it("replaces shared bytes internally, preserves old version, blocks stale replacement and restores internally", async () => {
    const { asset } = await uploaded(); const shared = await changeManagedFile(asset.id, { action: "share", expectedRevision: asset.revision });
    const input = { projectId: ids.projectA, villaId: ids.villaA, kind: "doc", label: asset.label, fileName: "new.pdf", contentType: "application/pdf", byteSize: pdf.length, assetId: asset.id, expectedRevision: shared.revision };
    const first = await createUploadIntent(input); const second = await createUploadIntent(input);
    await acceptLocalUpload(first.intentId, pdf); await acceptLocalUpload(second.intentId, pdf);
    const replaced = await finalizeUpload(asset.id, first.intentId); expect(replaced.visibility).toBe("internal");
    await expect(finalizeUpload(asset.id, second.intentId)).rejects.toThrow("another session");
    expect(await db.select().from(assetVersion).where(eq(assetVersion.assetId, asset.id))).toHaveLength(2);
    as("buyerA"); await expect(downloadManagedFile(asset.id)).rejects.toThrow("not found");
    as("dev"); const archived = await changeManagedFile(asset.id, { action: "archive", expectedRevision: replaced.revision });
    const restored = await changeManagedFile(asset.id, { action: "restore", expectedRevision: archived.revision }); expect(restored.visibility).toBe("internal"); expect(restored.archivedAt).toBeNull();
  });
});
