import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

// Exercise the actual Drizzle SQL builder/projection, mocking only the driver.
// No database credentials or live records are used by these isolation tests.
vi.mock("@/db/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return { db: drizzle(query) };
});

import { getOwnedVillaChoicesForAccount } from "./koper-data";

beforeEach(() => { query.mockReset(); });

describe("owned residence choices — SQL authorization boundary", () => {
  it("joins ownership for the bound session account and projects only three display fields", async () => {
    query.mockResolvedValue({ rows: [
      ["owned-1", "Villa 1", "Cemagi Atelier"],
      ["owned-2", "Villa 9", "Second project"],
    ] });
    await expect(getOwnedVillaChoicesForAccount("session-account-a")).resolves.toEqual([
      { id: "owned-1", code: "Villa 1", projectName: "Cemagi Atelier" },
      { id: "owned-2", code: "Villa 9", projectName: "Second project" },
    ]);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('select "villa"."id", "villa"."code", "project"."name"');
    expect(sql).toContain('inner join "buyer_villa" on "buyer_villa"."buyer_id" = "buyer"."id"');
    expect(sql).toContain('inner join "villa" on "villa"."id" = "buyer_villa"."villa_id"');
    expect(sql).toContain('inner join "project" on "project"."id" = "villa"."project_id"');
    expect(sql).toContain('where "buyer"."account_id" = $1');
    expect(params).toEqual(["session-account-a"]);
    expect(sql).toContain('order by "project"."name" asc, "villa"."code" asc, "villa"."id" asc');
  });

  it("does not share options across accounts or invent a fallback for an unlinked account", async () => {
    query.mockImplementation(async (_sql, params) => ({
      rows: params[0] === "linked-account" ? [["owned-1", "Villa 1", "Cemagi"]] : [],
    }));
    expect(await getOwnedVillaChoicesForAccount("linked-account")).toHaveLength(1);
    expect(await getOwnedVillaChoicesForAccount("unlinked-account")).toEqual([]);
    expect(query.mock.calls[1][1]).toEqual(["unlinked-account"]);
  });
});
