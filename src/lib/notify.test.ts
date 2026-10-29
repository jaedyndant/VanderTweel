import { describe, it, expect, vi, beforeEach } from "vitest";

// MS5 klaar-criterium (PvA): "Een testactie komt binnen 1 minuut aan bij de
// juiste koper, bij niemand anders." TDD per TO 11.2/11.3: this is the
// highest-risk coupling in the whole project (team action -> database ->
// notification), so the test for "exactly the right buyer, never anyone
// else" is written before notifyBuyersForVilla's implementation exists.

vi.mock("@/db/client", () => ({
  db: {
    query: {
      buyerVilla: { findMany: vi.fn() },
      buyer: { findMany: vi.fn() },
      account: { findMany: vi.fn() },
    },
    insert: vi.fn(),
  },
}));

vi.mock("./mailer", () => ({
  sendEmail: vi.fn(),
}));

import { db } from "@/db/client";
import { sendEmail } from "./mailer";
import { notifyBuyersForVilla } from "./notify";

const VILLA_A = "aaaaaaaa-0000-0000-0000-000000000001";
const VILLA_B = "bbbbbbbb-0000-0000-0000-000000000002";
const BUYER_A = "cccccccc-0000-0000-0000-000000000003";
const BUYER_OTHER = "eeeeeeee-0000-0000-0000-000000000005";
const ACCOUNT_A = "ffffffff-0000-0000-0000-000000000006";
const SOURCE_ID = "dddddddd-0000-0000-0000-000000000004";

function mockInsertCapture() {
  const inserted: Record<string, unknown>[] = [];
  (db.insert as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    values: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
      const rows = Array.isArray(vals) ? vals : [vals];
      inserted.push(...rows);
      return Promise.resolve();
    },
  }));
  return inserted;
}

describe("notifyBuyersForVilla — the MS5 team-to-koper coupling, scope-checked", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notifies exactly the buyer(s) linked to THIS villa, via buyer_villa", async () => {
    (db.query.buyerVilla.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { buyerId: BUYER_A, villaId: VILLA_A },
    ]);
    (db.query.buyer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: BUYER_A, accountId: ACCOUNT_A, name: "Emma Larsen" },
    ]);
    (db.query.account.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: ACCOUNT_A, email: "buyer@cemagiatelier.test" },
    ]);
    const inserted = mockInsertCapture();

    const result = await notifyBuyersForVilla({
      villaId: VILLA_A,
      sourceType: "update",
      sourceId: SOURCE_ID,
      summary: "New update posted",
    });

    expect(result.notifiedBuyerIds).toEqual([BUYER_A]);
    expect(db.query.buyerVilla.findMany).toHaveBeenCalledTimes(1);
    const appRows = inserted.filter((r) => r.channel === "app");
    const emailRows = inserted.filter((r) => r.channel === "email");
    expect(appRows).toHaveLength(1);
    expect(emailRows).toHaveLength(1);
    expect(appRows[0]).toMatchObject({ buyerId: BUYER_A, sourceType: "update", sourceId: SOURCE_ID });
  });

  it("never notifies a buyer of a DIFFERENT villa — the eval scenario from TO 11.3", async () => {
    // Villa B's buyer_villa query only ever returns villa B's own links;
    // villa A's buyer (BUYER_A) is structurally unreachable from this call.
    (db.query.buyerVilla.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { buyerId: BUYER_OTHER, villaId: VILLA_B },
    ]);
    (db.query.buyer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: BUYER_OTHER, accountId: "other-account", name: "Other Buyer" },
    ]);
    (db.query.account.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "other-account", email: "other@cemagiatelier.test" },
    ]);
    mockInsertCapture();

    const result = await notifyBuyersForVilla({
      villaId: VILLA_B,
      sourceType: "payment",
      sourceId: SOURCE_ID,
      summary: "Payment marked paid",
    });

    expect(result.notifiedBuyerIds).toEqual([BUYER_OTHER]);
    expect(result.notifiedBuyerIds).not.toContain(BUYER_A);
    expect(db.query.buyerVilla.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.anything() })
    );
  });

  it("sends a real email to the buyer's account email for the email-channel notification", async () => {
    (db.query.buyerVilla.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { buyerId: BUYER_A, villaId: VILLA_A },
    ]);
    (db.query.buyer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: BUYER_A, accountId: ACCOUNT_A, name: "Emma Larsen" },
    ]);
    (db.query.account.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: ACCOUNT_A, email: "buyer@cemagiatelier.test" },
    ]);
    mockInsertCapture();

    await notifyBuyersForVilla({
      villaId: VILLA_A,
      sourceType: "progress",
      sourceId: SOURCE_ID,
      summary: "Foundation work completed",
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "buyer@cemagiatelier.test", text: expect.stringContaining("Foundation work completed") })
    );
  });

  it("a villa with zero linked buyers notifies no one and never calls sendEmail", async () => {
    (db.query.buyerVilla.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    mockInsertCapture();

    const result = await notifyBuyersForVilla({
      villaId: VILLA_A,
      sourceType: "file",
      sourceId: SOURCE_ID,
      summary: "New document added",
    });

    expect(result.notifiedBuyerIds).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("a failed email send does not throw and does not block the app-channel notification", async () => {
    (db.query.buyerVilla.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { buyerId: BUYER_A, villaId: VILLA_A },
    ]);
    (db.query.buyer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: BUYER_A, accountId: ACCOUNT_A, name: "Emma Larsen" },
    ]);
    (db.query.account.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: ACCOUNT_A, email: "buyer@cemagiatelier.test" },
    ]);
    const inserted = mockInsertCapture();
    (sendEmail as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Resend down"));

    const result = await notifyBuyersForVilla({
      villaId: VILLA_A,
      sourceType: "update",
      sourceId: SOURCE_ID,
      summary: "New update posted",
    });

    expect(result.notifiedBuyerIds).toEqual([BUYER_A]);
    const appRows = inserted.filter((r) => r.channel === "app");
    expect(appRows).toHaveLength(1);
    // email row is still recorded (as unsent / attempted), just not sentAt-stamped
    const emailRows = inserted.filter((r) => r.channel === "email");
    expect(emailRows).toHaveLength(1);
    expect(emailRows[0].sentAt).toBeNull();
  });
});
