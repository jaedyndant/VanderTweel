import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authPost, checkRateLimit, clientIp } = vi.hoisted(() => ({
  authPost: vi.fn(),
  checkRateLimit: vi.fn(),
  clientIp: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  handlers: { GET: vi.fn(), POST: authPost },
}));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit, clientIp }));

import { POST } from "./route";

function signinRequest() {
  const body = new URLSearchParams({
    email: " Buyer+QA@Example.com ",
    csrfToken: "csrf-token+with/special=characters",
    callbackUrl: "https://example.com/koper?view=home&villa=1",
  }).toString();
  const request = new NextRequest("https://example.com/api/auth/signin/resend", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      cookie: "authjs.csrf-token=token%7Chash; authjs.callback-url=%2Fkoper",
      "x-forwarded-for": "192.0.2.1",
      "x-auth-return-redirect": "1",
      origin: "https://example.com",
    },
    body,
  });
  return { request, body };
}

describe("auth POST rate-limit wrapper", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    checkRateLimit.mockResolvedValue(true);
    clientIp.mockReturnValue("192.0.2.1");
  });

  it("passes the original URL-encoded request intact to Auth.js after both limits pass", async () => {
    const { request, body } = signinRequest();
    const headers = [...request.headers.entries()];
    const authResponse = Response.json({ url: "/api/auth/verify-request" });
    authPost.mockImplementation(async (received: NextRequest) => {
      expect(received).toBe(request);
      expect(received.bodyUsed).toBe(false);
      expect([...received.headers.entries()]).toEqual(headers);
      expect(received.cookies.get("authjs.csrf-token")?.value).toBe("token|hash");
      const rawBody = await received.text();
      expect(rawBody).toBe(body);
      const fields = new URLSearchParams(rawBody);
      expect(fields.get("email")).toBe(" Buyer+QA@Example.com ");
      expect(fields.get("csrfToken")).toBe("csrf-token+with/special=characters");
      expect(fields.get("callbackUrl")).toBe("https://example.com/koper?view=home&villa=1");
      return authResponse;
    });

    expect(await POST(request)).toBe(authResponse);
    expect(authPost).toHaveBeenCalledExactlyOnceWith(request);
    expect(clientIp).toHaveBeenCalledExactlyOnceWith(request);
    expect(checkRateLimit.mock.calls).toEqual([
      ["signin:ip:192.0.2.1", 5, 600],
      ["signin:email:buyer+qa@example.com", 3, 600],
    ]);
  });

  it("rejects an IP over its limit before inspecting the email or calling Auth.js", async () => {
    const { request } = signinRequest();
    checkRateLimit.mockResolvedValueOnce(false);

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledExactlyOnceWith("signin:ip:192.0.2.1", 5, 600);
    expect(authPost).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
  });

  it("rejects an email over its limit without calling Auth.js or consuming the original body", async () => {
    const { request, body } = signinRequest();
    checkRateLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(checkRateLimit).toHaveBeenNthCalledWith(2, "signin:email:buyer+qa@example.com", 3, 600);
    expect(authPost).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
    expect(await request.text()).toBe(body);
  });

  it("passes non-signin POST requests through untouched without applying sign-in limits", async () => {
    const request = new NextRequest("https://example.com/api/auth/signout", {
      method: "POST",
      body: new URLSearchParams({ csrfToken: "signout-token", callbackUrl: "/login" }),
    });
    const authResponse = new Response(null, { status: 302, headers: { location: "/login" } });
    authPost.mockImplementation(async (received: NextRequest) => {
      expect(received).toBe(request);
      expect(received.bodyUsed).toBe(false);
      expect((await received.formData()).get("csrfToken")).toBe("signout-token");
      return authResponse;
    });

    expect(await POST(request)).toBe(authResponse);
    expect(authPost).toHaveBeenCalledExactlyOnceWith(request);
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(clientIp).not.toHaveBeenCalled();
  });

  it.each([
    ["unsupported content type", "text/plain", "email=buyer@example.com"],
    ["malformed multipart form", "multipart/form-data", "missing boundary"],
  ])("rejects %s as a bad request instead of throwing", async (_, contentType, body) => {
    const request = new NextRequest("https://example.com/api/auth/signin/resend", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid sign-in request." });
    expect(checkRateLimit).toHaveBeenCalledOnce();
    expect(authPost).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
  });
});
