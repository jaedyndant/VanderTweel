import { afterEach, describe, expect, it, vi } from "vitest";
import { requestLoginLink } from "./request-login-link";

// Deliberately do not mock next-auth/react. These tests exercise the installed
// signIn transport and replace HTTP only; they never call the DB/mail provider.
function fakeAuthTransport({
  status = 200,
  error,
  fail = false,
}: { status?: number; error?: string; fail?: boolean } = {}) {
  const postBodies: URLSearchParams[] = [];
  const requests: string[] = [];
  vi.stubGlobal("window", {
    location: { href: "http://localhost/login", reload: vi.fn() },
  });
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), "http://localhost").pathname;
    requests.push(path);
    if (path.endsWith("/providers"))
      return Response.json({
        resend: { id: "resend", name: "Resend", type: "email" },
      });
    if (path.endsWith("/csrf"))
      return Response.json({ csrfToken: "regression-test-csrf-token" });
    if (path.endsWith("/signin/resend")) {
      postBodies.push(new URLSearchParams(String(init?.body)));
      expect(init?.method?.toLowerCase()).toBe("post");
      expect(new Headers(init?.headers).get("X-Auth-Return-Redirect")).toBe(
        "1",
      );
      if (fail) throw new Error("simulated transport failure");
      return Response.json(
        {
          url: error
            ? `http://localhost/login?error=${error}`
            : "http://localhost/login/check-email?provider=resend&type=email",
        },
        { status },
      );
    }
    throw new Error(`Unexpected test request: ${path}`);
  });
  vi.stubGlobal("fetch", fetch);
  return { postBodies, requests };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("magic-link request through installed Auth.js client", () => {
  it("fetches CSRF before POST and preserves the requested callback", async () => {
    const { postBodies, requests } = fakeAuthTransport();
    const accepted = await requestLoginLink(
      " reviewer@example.test ",
      "/office/villas/A/voortgang?projectId=p1",
    );
    expect(accepted).toBe(true);
    expect(requests).toEqual([
      "/api/auth/providers",
      "/api/auth/csrf",
      "/api/auth/signin/resend",
    ]);
    expect(postBodies).toHaveLength(1);
    expect(postBodies[0].get("csrfToken")).toBe("regression-test-csrf-token");
    expect(postBodies[0].get("email")).toBe("reviewer@example.test");
    expect(postBodies[0].get("callbackUrl")).toBe(
      "/office/villas/A/voortgang?projectId=p1",
    );
  });

  it.each(["MissingCSRF", "AccessDenied", "Verification", "Configuration"])(
    "never presents a 200 error redirect as accepted (%s)",
    async (error) => {
      fakeAuthTransport({ error });
      expect(await requestLoginLink("reviewer@example.test", "/koper")).toBe(
        false,
      );
    },
  );

  it("does not accept a failed HTTP response even without an error parameter", async () => {
    fakeAuthTransport({ status: 503 });
    expect(await requestLoginLink("reviewer@example.test", "/office")).toBe(
      false,
    );
  });

  it("returns a retryable failure after a network error", async () => {
    fakeAuthTransport({ fail: true });
    expect(await requestLoginLink("reviewer@example.test", "/office")).toBe(
      false,
    );
  });

  it.each([
    "/",
    "//external.invalid/office",
    "https://external.invalid/office",
    "/login",
  ])(
    "routes direct or unsafe callbacks through the server role landing page (%s)",
    async (callback) => {
      const { postBodies } = fakeAuthTransport();
      expect(await requestLoginLink("reviewer@example.test", callback)).toBe(
        true,
      );
      expect(postBodies[0].get("callbackUrl")).toBe("/login");
    },
  );
});
