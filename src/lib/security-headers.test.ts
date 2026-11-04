import { afterEach, describe, expect, it, vi } from "vitest";

async function configuredHeaders(mode: "production" | "development") {
  vi.stubEnv("NODE_ENV", mode);
  vi.resetModules();
  const { default: config } = await import("../../next.config");
  const rules = await config.headers!();
  const globalRule = rules.find((rule) => rule.source === "/:path*");
  expect(globalRule, "Security headers must cover /login and protected routes").toBeDefined();

  const headers = new Headers(
    globalRule!.headers.map(({ key, value }): [string, string] => [key, value]),
  );
  const csp = headers.get("Content-Security-Policy");
  expect(csp).not.toBeNull();
  const directives = new Map(
    csp!.split(";").map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );

  return { config, headers, directives };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("framework-compatible security headers", () => {
  it("allows prerendered Next bootstrap scripts in production without enabling eval or remote scripts", async () => {
    const { config, directives } = await configuredHeaders("production");
    // The inline bootstrap has no per-request nonce in a prerendered shell.
    // Allowing only 'self' blocks hydration and leaves login uninitialised.
    expect(directives.get("script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(config.cacheComponents).toBe(true);
    expect(config.partialPrefetching).toBe(true);
  });

  it("retains restrictions on inline handlers, plugins, framing, and submission targets", async () => {
    const { directives, headers } = await configuredHeaders("production");
    expect(directives.get("script-src-attr")).toEqual(["'none'"]);
    expect(directives.get("object-src")).toEqual(["'none'"]);
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
    expect(directives.get("default-src")).toEqual(["'self'"]);
    expect(directives.get("base-uri")).toEqual(["'self'"]);
    expect(directives.get("form-action")).toEqual(["'self'"]);
    expect(directives.get("connect-src")).toEqual(["'self'", "https://vercel.com/api/blob", "https://vercel.com/api/blob/"]);
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains; preload");
  });

  it("permits only the official direct-upload API without broadening external connections", async () => {
    const { directives } = await configuredHeaders("production");
    const sources = directives.get("connect-src")!;
    expect(sources).not.toContain("https:");
    expect(sources).not.toContain("https://vercel.com");
    expect(sources.some(source => source.includes("*"))).toBe(false);
    // Both forms matter: SDK requests use the root and trailing-slash paths.
    expect(sources).toContain("https://vercel.com/api/blob");
    expect(sources).toContain("https://vercel.com/api/blob/");
  });

  it("allows React development diagnostics while keeping the production source restrictions", async () => {
    const { directives } = await configuredHeaders("development");
    expect(directives.get("script-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
    ]);
    expect(directives.get("script-src-attr")).toEqual(["'none'"]);
    expect(directives.get("object-src")).toEqual(["'none'"]);
  });
});
