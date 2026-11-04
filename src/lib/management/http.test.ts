import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/platform-access", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/platform-access")>(), requireActor: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/mail-outbox", () => ({ dispatchMailOutbox: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
import { requireActor } from "@/lib/platform-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { managementMutation } from "./http";

function request(origin = "https://owners.example.org", body = "{}") {
  return new Request("https://owners.example.org/api/management/invitations", { method: "POST", headers: { origin, "content-type": "application/json" }, body });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireActor).mockResolvedValue({ id: "developer", role: "developer", email: "dev@example.org", displayName: null });
  vi.mocked(checkRateLimit).mockResolvedValue(true);
});
describe("management mutation boundary", () => {
  it("blocks cross-origin and missing-origin mutation requests before authentication or writes", async () => {
    const operation = vi.fn();
    for (const origin of ["https://attacker.example", "null", ""]) expect((await managementMutation(request(origin), operation)).status).toBe(403);
    expect(requireActor).not.toHaveBeenCalled(); expect(operation).not.toHaveBeenCalled();
  });
  it("requires a live developer session on every request", async () => {
    const operation = vi.fn();
    vi.mocked(requireActor).mockRejectedValue(Object.assign(new Error("No"), { status: 403 }));
    expect((await managementMutation(request(), operation)).status).toBe(403);
    expect(requireActor).toHaveBeenCalledWith(true); expect(operation).not.toHaveBeenCalled();
  });
  it("does not execute invalid JSON, oversized bodies or rate-limited mail requests", async () => {
    const operation = vi.fn();
    expect((await managementMutation(request(undefined, "[invalid"), operation)).status).toBe(400);
    expect((await managementMutation(request(undefined, "a".repeat(65537)), operation)).status).toBe(413);
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    expect((await managementMutation(request(), operation, true)).status).toBe(429);
    expect(operation).not.toHaveBeenCalled();
  });
  it("never exposes internal database/provider error text", async () => {
    const response = await managementMutation(request(), vi.fn().mockRejectedValue(new Error("SECRET DATABASE URL")));
    expect(response.status).toBe(500); expect(await response.text()).not.toContain("SECRET");
  });
});
