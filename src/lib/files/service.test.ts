import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireActor: vi.fn(), assertScope: vi.fn(), select: vi.fn(), transaction: vi.fn(), inspect: vi.fn(), read: vi.fn(), event: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { select: mocks.select, transaction: mocks.transaction } }));
vi.mock("@/lib/platform-access", () => ({ requireActor: mocks.requireActor, assertScope: mocks.assertScope }));
vi.mock("@/lib/platform-events", () => ({ writePlatformEvent: mocks.event }));
vi.mock("./storage", () => ({ inspectStoredUpload: mocks.inspect, readStoredFile: mocks.read, localStorageEnabled: () => false, storageConfigured: () => true, writeLocalUpload: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(() => true) }));
import { downloadManagedFile, finalizeUpload, listManagedFiles } from "./service";
const assetId = "b673e318-8f4a-4acf-96d9-5e4cd5496907";
const intentId = "a673e318-8f4a-4acf-96d9-5e4cd5496907";
const actorId = "c673e318-8f4a-4acf-96d9-5e4cd5496907";
const actor = { id: actorId, role: "developer", email: "staff@example.test", displayName: null };
const asset = { id: assetId, projectId: "project-one", villaId: "villa-one", kind: "doc", label: "Contract", note: "", visibility: "shared", activeVersion: 2, revision: 3, archivedAt: null, createdAt: new Date(), updatedAt: new Date() };
function queueSelect(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "innerJoin", "where", "limit", "for"]) chain[method] = () => chain;
  chain.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve(resolve(rows));
  mocks.select.mockReturnValueOnce(chain);
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.requireActor.mockResolvedValue(actor); mocks.assertScope.mockResolvedValue({}); mocks.inspect.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async callback => callback({ select: mocks.select, insert: vi.fn(() => { throw new Error("Unexpected write"); }), update: vi.fn(() => { throw new Error("Unexpected write"); }) }));
  mocks.read.mockImplementation(async () => new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("pdf")); c.close(); } }));
});
describe("authenticated download authorization", () => {
  it("denies buyer access to the team file list including internal metadata", async () => {
    mocks.requireActor.mockResolvedValue({ ...actor, role: "buyer" });
    await expect(listManagedFiles({ projectId: assetId })).rejects.toThrow("team only"); expect(mocks.select).not.toHaveBeenCalled();
  });
  it("denies a PM direct access to a document even when its id is known", async () => {
    mocks.requireActor.mockResolvedValue({ ...actor, role: "pm" }); queueSelect([asset]);
    await expect(downloadManagedFile(assetId)).rejects.toThrow("not available"); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("denies an unrelated buyer and never opens blob storage", async () => {
    mocks.requireActor.mockResolvedValue({ ...actor, role: "buyer" }); queueSelect([asset]); queueSelect([]);
    await expect(downloadManagedFile(assetId)).rejects.toThrow("not found"); expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each([{ visibility: "internal" }, { archivedAt: new Date() }])("denies buyer access after hiding or archiving", async patch => {
    mocks.requireActor.mockResolvedValue({ ...actor, role: "buyer" }); queueSelect([{ ...asset, ...patch }]);
    await expect(downloadManagedFile(assetId)).rejects.toThrow("not found"); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("checks PM project assignment before opening a photo", async () => {
    mocks.requireActor.mockResolvedValue({ ...actor, role: "pm" }); mocks.assertScope.mockRejectedValue(new Error("Not permitted")); queueSelect([{ ...asset, kind: "photo" }]);
    await expect(downloadManagedFile(assetId)).rejects.toThrow("Not permitted"); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("serves only the currently active stored version without caching or leaking its path", async () => {
    mocks.requireActor.mockResolvedValue({ ...actor, role: "buyer" }); queueSelect([asset]); queueSelect([{ projectId: asset.projectId }]); queueSelect([{ storagePath: "private-current-version", contentType: "application/pdf", fileName: "contract.pdf", byteSize: 3 }]);
    const response = await downloadManagedFile(assetId);
    expect(mocks.read).toHaveBeenCalledWith("private-current-version"); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("location")).toBeNull(); expect(await response.text()).toBe("pdf");
  });
});
describe("upload finalization concurrency boundaries", () => {
  const intent = { id: intentId, assetId, actorId, storagePath: "private-upload", fileName: "contract.pdf", contentType: "application/pdf", byteSize: 100, expectedRevision: 2, expiresAt: new Date("2030-01-01"), finalizedAt: null };
  it("refuses another actor's upload before storage verification", async () => {
    queueSelect([]); await expect(finalizeUpload(assetId, intentId)).rejects.toThrow("not found"); expect(mocks.inspect).not.toHaveBeenCalled();
  });
  it("does not finalize over a concurrently changed asset or send notifications", async () => {
    queueSelect([intent]); queueSelect([asset]); queueSelect([intent]);
    await expect(finalizeUpload(assetId, intentId)).rejects.toThrow("another session"); expect(mocks.event).not.toHaveBeenCalled();
  });
  it("treats a repeated completion as idempotent without inserting or notifying again", async () => {
    const completed = { ...intent, finalizedAt: new Date() }; queueSelect([completed]); queueSelect([asset]); queueSelect([completed]);
    const result = await finalizeUpload(assetId, intentId); expect(result.id).toBe(assetId); expect(mocks.inspect).not.toHaveBeenCalled(); expect(mocks.event).not.toHaveBeenCalled();
  });
});
