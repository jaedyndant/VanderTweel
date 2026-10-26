import { describe, it, expect, vi, beforeEach } from "vitest";

// TDD per TO 11.2: the signIn gate is the single highest-risk check in MS2 —
// it decides whether an unknown email can ever get a magic link at all.
// TO 9.1: no self-registration; every account (buyer/pm/developer) is
// provisioned in advance by the team, never created by the login flow itself.

vi.mock("@/db/client", () => {
  return {
    db: {
      query: {
        account: {
          findFirst: vi.fn(),
        },
      },
    },
  };
});

import { db } from "@/db/client";
import { isKnownAccountEmail } from "./auth-adapter";

describe("isKnownAccountEmail — blocks magic-link issuance to unseeded emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true for an email that matches a pre-seeded account", async () => {
    (db.query.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      email: "buyer@example.com",
      role: "buyer",
    });

    await expect(isKnownAccountEmail("buyer@example.com")).resolves.toBe(true);
  });

  it("returns false for an email with no matching account (no self-registration)", async () => {
    (db.query.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(isKnownAccountEmail("stranger@example.com")).resolves.toBe(false);
  });

  it("is case-insensitive on the email lookup", async () => {
    (db.query.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
      email: "pm@example.com",
      role: "pm",
    });

    await expect(isKnownAccountEmail("PM@Example.com")).resolves.toBe(true);
  });
});
