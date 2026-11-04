import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { assertFileSignature, assertIntentUsable, assertPhotoPermission, assertRevision, intentSchema, privateFileHeaders } from "./policy";
import { assertSameOrigin, readBoundedBytes } from "./http";
const valid = { projectId: "b673e318-8f4a-4acf-96d9-5e4cd5496907", kind: "photo", label: "Build", fileName: "build.jpg", contentType: "image/jpeg", byteSize: 100 };
describe("file authorization boundaries", () => {
  it("prevents buyers and PMs from uploading or directly reading documents", () => {
    expect(() => assertPhotoPermission("buyer", "photo")).toThrow();
    expect(() => assertPhotoPermission("pm", "doc")).toThrow();
    expect(() => assertPhotoPermission("pm", "photo")).not.toThrow();
    expect(() => assertPhotoPermission("developer", "doc")).not.toThrow();
  });
  it("binds intent to its actor, expiration and single completion", () => {
    const intent = { actorId: "one", expiresAt: new Date("2030-01-01"), finalizedAt: null };
    expect(() => assertIntentUsable(intent, "two")).toThrow("not found");
    expect(() => assertIntentUsable(intent, "one", new Date("2030-01-01"))).toThrow("expired");
    expect(() => assertIntentUsable({ ...intent, finalizedAt: new Date() }, "one")).toThrow("already complete");
  });
  it("rejects a stale revision rather than overwriting a concurrent change", () => {
    expect(() => assertRevision(3, 2)).toThrow("another session");
  });
  it("requires same-origin JSON or byte mutations", () => {
    expect(() => assertSameOrigin(new Request("https://app.test/api/files", { headers: { origin: "https://attacker.test", "content-type": "application/json" } }))).toThrow();
    expect(() => assertSameOrigin(new Request("https://app.test/api/files", { headers: { origin: "https://app.test", "content-type": "text/plain" } }))).toThrow();
    expect(() => assertSameOrigin(new Request("https://app.test/api/files", { headers: { origin: "https://app.test", "content-type": "application/json" } }))).not.toThrow();
  });
});
describe("uploads and private reads", () => {
  it("rejects mixed extension/type, unknown type, documents disguised as photos and oversize photos", () => {
    for (const patch of [{ fileName: "photo.svg" }, { contentType: "image/svg+xml" }, { contentType: "application/pdf", fileName: "doc.pdf" }, { byteSize: 16 * 1024 * 1024 }, { fileName: "../photo.jpg" }]) expect(intentSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
    expect(intentSchema.safeParse(valid).success).toBe(true);
  });
  it("requires a revision when replacing an existing asset", () => {
    expect(intentSchema.safeParse({ ...valid, assetId: valid.projectId }).success).toBe(false);
  });
  it.each([
    ["application/pdf", [37, 80, 68, 70, 45]], ["image/jpeg", [255, 216, 255]],
    ["image/png", [137, 80, 78, 71, 13, 10, 26, 10]],
    ["image/webp", [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]],
  ])("checks real %s signatures, not only user metadata", (mime, signature) => {
    expect(() => assertFileSignature(mime, new Uint8Array(signature))).not.toThrow();
    expect(() => assertFileSignature(mime, new TextEncoder().encode("<script>evil</script>"))).toThrow();
  });
  it("downloads docs as attachments with no-store, nosniff and sandbox", () => {
    const headers = privateFileHeaders("application/pdf", "contract\".pdf", false);
    expect(headers["Cache-Control"]).toContain("no-store");
    expect(headers["Content-Disposition"]).toMatch(/^attachment;/);
    expect(headers["Content-Disposition"]).not.toContain('contract"');
    expect(headers["Content-Security-Policy"]).toContain("sandbox");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });
  it("bounds streamed bytes even without content-length", async () => {
    const request = new Request("http://localhost/upload", { method: "PUT", body: new Uint8Array(20) });
    await expect(readBoundedBytes(request, 10)).rejects.toThrow("too large");
  });
});
