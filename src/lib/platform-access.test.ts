import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { AccessError, apiError } from "./platform-access";

afterEach(() => vi.restoreAllMocks());
describe("platform HTTP error boundary", () => {
  it("preserves unauthenticated and forbidden responses", () => {
    expect(apiError(new AccessError("Sign in", 401)).status).toBe(401);
    expect(apiError(new AccessError()).status).toBe(403);
  });
  it("rejects invalid input without exposing schema internals", async () => {
    const parsed = z.uuid().safeParse("invalid");
    const response = apiError(parsed.error);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request." });
  });
  it("does not swallow Next.js rendering/redirect control flow", () => {
    const redirect = Object.assign(new Error("redirect"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    expect(() => apiError(redirect)).toThrow(redirect);
  });
  it("sanitizes unexpected server failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = apiError(new Error("database password and private SQL"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private SQL");
  });
});
