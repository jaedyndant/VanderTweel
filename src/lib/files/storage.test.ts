import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectStoredUpload, localStorageEnabled, readStoredFile, writeLocalUpload } from "./storage";
const folders: string[] = [];
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
describe("private local-test adapter", () => {
  it("cannot be enabled in production or without the explicit local-test marker", () => {
    vi.stubEnv("FILE_STORAGE_DRIVER", "local"); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("FILE_LOCAL_TEST", "true");
    expect(localStorageEnabled()).toBe(false);
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("FILE_LOCAL_TEST", "false"); expect(localStorageEnabled()).toBe(false);
  });
  it("keeps immutable private bytes, rejects traversal and verifies actual byte count", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vdt-files-test-")); folders.push(directory);
    vi.stubEnv("FILE_STORAGE_DRIVER", "local"); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("FILE_LOCAL_TEST", "true"); vi.stubEnv("FILE_LOCAL_DIRECTORY", directory);
    const path = "managed/b673e318-8f4a-4acf-96d9-5e4cd5496907/a673e318-8f4a-4acf-96d9-5e4cd5496907.pdf";
    const bytes = new TextEncoder().encode("%PDF-1.4\nfixture");
    await writeLocalUpload(path, "application/pdf", bytes);
    await expect(writeLocalUpload(path, "application/pdf", bytes)).rejects.toThrow();
    await expect(inspectStoredUpload(path, { contentType: "application/pdf", byteSize: 3 })).rejects.toThrow("size");
    await expect(inspectStoredUpload(path, { contentType: "application/pdf", byteSize: bytes.length })).resolves.toBeUndefined();
    const stream = await readStoredFile(path); expect(await new Response(stream).text()).toBe("%PDF-1.4\nfixture");
    await expect(writeLocalUpload("../outside.pdf", "application/pdf", bytes)).rejects.toThrow("Invalid storage path");
  });
});
