import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const onConflictDoUpdateMock = vi.fn();
const valuesMock = vi.fn();

vi.mock("@/db/client", () => ({
  db: {
    insert: (...args: unknown[]) => insertMock(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  rateLimitHit: { bucketKey: "bucketKey", windowStart: "windowStart", count: "count" },
}));

import { checkRateLimit, clientIp } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    insertMock.mockReset();
    valuesMock.mockReset();
    onConflictDoUpdateMock.mockReset();
  });

  function mockCount(count: number) {
    const returningMock = vi.fn().mockResolvedValue([{ count }]);
    onConflictDoUpdateMock.mockReturnValue({ returning: returningMock });
    valuesMock.mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
    insertMock.mockReturnValue({ values: valuesMock });
  }

  it("allows a hit under the limit", async () => {
    mockCount(1);
    const ok = await checkRateLimit("signin:ip:1.2.3.4", 5, 600);
    expect(ok).toBe(true);
  });

  it("allows a hit exactly at the limit", async () => {
    mockCount(5);
    const ok = await checkRateLimit("signin:ip:1.2.3.4", 5, 600);
    expect(ok).toBe(true);
  });

  it("rejects a hit over the limit", async () => {
    mockCount(6);
    const ok = await checkRateLimit("signin:ip:1.2.3.4", 5, 600);
    expect(ok).toBe(false);
  });
});

describe("clientIp", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(clientIp(req)).toBe("9.9.9.9");
  });

  it("falls back to unknown when neither header is present", () => {
    const req = new Request("https://example.com");
    expect(clientIp(req)).toBe("unknown");
  });
});
