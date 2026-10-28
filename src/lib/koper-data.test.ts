import { describe, it, expect, vi, beforeEach } from "vitest";

// MS3 klaar-criterium (PvA 4.2): "Een koper ziet zijn eigen villa en niets
// van een ander." Written TDD-first per TO 11.2/11.3 — this is the single
// most important test in this milestone. The pure function has zero DB
// dependency, so the isolation guarantee holds independent of any query
// implementation detail.

import { resolveAuthorizedVillaId } from "./koper-data";

const VILLA_A = "a2f44b0b-85e1-4a3b-8e93-435bd50f489b"; // Emma Larsen
const VILLA_B = "220cb397-f00a-405c-8bc8-d3416e226840"; // Marcus Oduya

describe("resolveAuthorizedVillaId — pure authorization gate (no DB)", () => {
  it("resolves to the buyer's own villa when no specific id is requested", () => {
    expect(resolveAuthorizedVillaId([VILLA_A])).toBe(VILLA_A);
  });

  it("resolves a requested id that the buyer actually owns", () => {
    expect(resolveAuthorizedVillaId([VILLA_A], VILLA_A)).toBe(VILLA_A);
  });

  it("NEVER resolves a requested id belonging to another buyer's villa", () => {
    // Buyer A's owned list never contains villa B — guessing/forging the id
    // in a URL must not grant access.
    expect(resolveAuthorizedVillaId([VILLA_A], VILLA_B)).toBeNull();
  });

  it("NEVER resolves villa A's id for a buyer who only owns villa B (symmetry check)", () => {
    expect(resolveAuthorizedVillaId([VILLA_B], VILLA_A)).toBeNull();
  });

  it("returns null (fails closed) for a buyer linked to no villa at all", () => {
    expect(resolveAuthorizedVillaId([], VILLA_A)).toBeNull();
    expect(resolveAuthorizedVillaId([])).toBeNull();
  });

  it("is not fooled by an empty-string or falsy requested id — falls back to the buyer's own villa", () => {
    expect(resolveAuthorizedVillaId([VILLA_A], "")).toBe(VILLA_A);
    expect(resolveAuthorizedVillaId([VILLA_A], null)).toBe(VILLA_A);
    expect(resolveAuthorizedVillaId([VILLA_A], undefined)).toBe(VILLA_A);
  });

  it("only ever returns an id that is a member of ownedVillaIds, for any requested id", () => {
    // Property check across a spread of inputs: the function must never
    // invent or leak an id outside the owned set.
    const owned = [VILLA_A];
    for (const requested of [VILLA_B, "random-guessed-id", "../../etc/passwd", VILLA_A]) {
      const result = resolveAuthorizedVillaId(owned, requested);
      expect(result === null || owned.includes(result)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// DB-backed wrappers: mocked at the db.query boundary (same pattern as
// auth-adapter.test.ts) to prove the end-to-end query functions apply the
// same authorization gate and never fetch by a raw client-supplied villa id.
// ---------------------------------------------------------------------------

vi.mock("@/db/client", () => {
  return {
    db: {
      query: {
        buyer: { findFirst: vi.fn() },
        buyerVilla: { findMany: vi.fn() },
        villa: { findFirst: vi.fn() },
        progressTask: { findMany: vi.fn() },
        update: { findMany: vi.fn() },
        paymentMilestone: { findMany: vi.fn() },
        file: { findMany: vi.fn() },
      },
    },
  };
});

import { db } from "@/db/client";
import {
  getOwnedVillaIdsForAccount,
  getAuthorizedVilla,
  getVillaOverview,
  getVillaProgress,
  getPaymentSchedule,
} from "./koper-data";

const ACCOUNT_A = "11111111-1111-1111-1111-111111111111";
const ACCOUNT_B = "22222222-2222-2222-2222-222222222222";
const BUYER_A_ID = "33333333-3333-3333-3333-333333333333";
const BUYER_B_ID = "44444444-4444-4444-4444-444444444444";

function mockAccountOwningVillaA() {
  (db.query.buyer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: BUYER_A_ID,
    accountId: ACCOUNT_A,
    name: "Emma Larsen",
  });
  (db.query.buyerVilla.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
    { buyerId: BUYER_A_ID, villaId: VILLA_A },
  ]);
  (db.query.villa.findFirst as ReturnType<typeof vi.fn>).mockImplementation(
    async ({ where }: { where: unknown }) => {
      // drizzle-orm eq() builds an opaque SQL node; for this mock we only
      // need to simulate "villa exists" vs "villa doesn't exist" — the real
      // authorization already happened in resolveAuthorizedVillaId before
      // this query is ever issued, so returning VILLA_A's row is correct as
      // long as getAuthorizedVilla never calls this with VILLA_B's id.
      void where;
      return { id: VILLA_A, code: "Villa 3" };
    }
  );
}

function mockAccountOwningVillaB() {
  (db.query.buyer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: BUYER_B_ID,
    accountId: ACCOUNT_B,
    name: "Marcus Oduya",
  });
  (db.query.buyerVilla.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
    { buyerId: BUYER_B_ID, villaId: VILLA_B },
  ]);
  (db.query.villa.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: VILLA_B,
    code: "Villa 1",
  });
}

describe("getOwnedVillaIdsForAccount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the villa ids linked to this account's buyer row", async () => {
    mockAccountOwningVillaA();
    await expect(getOwnedVillaIdsForAccount(ACCOUNT_A)).resolves.toEqual([VILLA_A]);
  });

  it("returns an empty list for an account with no buyer row", async () => {
    (db.query.buyer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await expect(getOwnedVillaIdsForAccount(ACCOUNT_A)).resolves.toEqual([]);
  });
});

describe("getAuthorizedVilla — end-to-end isolation (buyer A vs buyer B)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("buyer A requesting their own villa gets villa A", async () => {
    mockAccountOwningVillaA();
    const result = await getAuthorizedVilla(ACCOUNT_A, VILLA_A);
    expect(result?.id).toBe(VILLA_A);
  });

  it("buyer A requesting buyer B's villa id gets null, never villa B's data", async () => {
    mockAccountOwningVillaA();
    const result = await getAuthorizedVilla(ACCOUNT_A, VILLA_B);
    expect(result).toBeNull();
    // Critically: the villa table is never even queried for an id the
    // account doesn't own — the authorization check short-circuits first.
    expect(db.query.villa.findFirst).not.toHaveBeenCalled();
  });

  it("buyer B requesting buyer A's villa id gets null (symmetry)", async () => {
    mockAccountOwningVillaB();
    const result = await getAuthorizedVilla(ACCOUNT_B, VILLA_A);
    expect(result).toBeNull();
    expect(db.query.villa.findFirst).not.toHaveBeenCalled();
  });

  it("an account with no buyer link gets null for any requested villa", async () => {
    (db.query.buyer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const result = await getAuthorizedVilla(ACCOUNT_A, VILLA_A);
    expect(result).toBeNull();
  });
});

describe("getVillaOverview / getVillaProgress / getPaymentSchedule — scoped screens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getVillaOverview returns null (not someone else's data) for a cross-buyer villa id", async () => {
    mockAccountOwningVillaA();
    await expect(getVillaOverview(ACCOUNT_A, VILLA_B)).resolves.toBeNull();
  });

  it("getVillaProgress returns null for a cross-buyer villa id and never fetches tasks", async () => {
    mockAccountOwningVillaA();
    (db.query.progressTask.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "x" }]);
    const result = await getVillaProgress(ACCOUNT_A, VILLA_B);
    expect(result).toBeNull();
    expect(db.query.progressTask.findMany).not.toHaveBeenCalled();
  });

  it("getPaymentSchedule returns null for a cross-buyer villa id and never fetches milestones", async () => {
    mockAccountOwningVillaA();
    (db.query.paymentMilestone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "y" }]);
    const result = await getPaymentSchedule(ACCOUNT_A, VILLA_B);
    expect(result).toBeNull();
    expect(db.query.paymentMilestone.findMany).not.toHaveBeenCalled();
  });

  it("getPaymentSchedule returns the villa's own milestones when authorized", async () => {
    mockAccountOwningVillaA();
    (db.query.paymentMilestone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "m1", villaId: VILLA_A, dueLabel: "Reservation" },
    ]);
    (db.query.file.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await getPaymentSchedule(ACCOUNT_A, VILLA_A);
    expect(result?.villa.id).toBe(VILLA_A);
    expect(result?.milestones).toEqual([{ id: "m1", villaId: VILLA_A, dueLabel: "Reservation" }]);
  });
});
