import { describe, expect, it } from "vitest";
import {
  officeHref,
  paymentAmount,
  paymentCsv,
  paymentTotals,
  safeFileUrl,
  villaHref,
} from "./presentation";
import type { OfficePayment, OfficeVilla } from "./types";

const villa: OfficeVilla = {
  id: "villa-a",
  code: "A/03",
  projectId: "project-a",
  projectName: "Atelier",
  projectSlug: "atelier",
  buyerName: null,
  status: "in_build",
  typeLabel: null,
  plotM2: null,
  builtM2: null,
  outdoorM2: null,
  buildStarted: null,
  handoverExpected: null,
  progressPercent: null,
  priceTotalUsd: 155000,
};
const payment: OfficePayment = {
  id: "payment-a",
  villaId: villa.id,
  villaCode: villa.code,
  projectId: villa.projectId,
  percent: 10,
  dueLabel: "Foundations",
  status: "open",
  paidAt: null,
  sequence: 1,
  amountUsd: null,
  note: null,
  expectedAt: null,
};

describe("office payment presentation", () => {
  it("uses explicit recorded amounts, including zero, before deriving a share", () => {
    expect(paymentAmount({ ...payment, amountUsd: 0 }, villa)).toBe(0);
    expect(paymentAmount({ ...payment, amountUsd: 1234 }, villa)).toBe(1234);
    expect(paymentAmount(payment, villa)).toBe(15500);
  });

  it("keeps absent agreement and milestone amounts unknown", () => {
    expect(
      paymentAmount(payment, { ...villa, priceTotalUsd: null }),
    ).toBeNull();
    expect(paymentAmount(payment)).toBeNull();
    expect(paymentTotals([], [villa])).toMatchObject({
      paid: null,
      remaining: null,
    });
  });

  it("does not silently zero an unknown amount in an aggregate", () => {
    const other = {
      ...payment,
      id: "other",
      villaId: "unknown",
      amountUsd: null,
    };
    expect(paymentTotals([payment, other], [villa])).toMatchObject({
      paid: 0,
      remaining: null,
    });
    expect(
      paymentTotals([{ ...other, status: "paid" }], [villa]).paid,
    ).toBeNull();
  });

  it("sums recorded schedules independently of construction state", () => {
    const result = paymentTotals(
      [
        { ...payment, status: "paid" },
        { ...payment, id: "next", amountUsd: 7500 },
      ],
      [villa],
    );
    expect(result).toMatchObject({
      paid: 15500,
      remaining: 7500,
      paidCount: 1,
      openCount: 1,
    });
    expect(result.next?.id).toBe("next");
    expect(villa.progressPercent).toBeNull();
  });

  it("exports actual statuses and unknown amounts without unsafe CSV formulas", () => {
    const csv = paymentCsv(
      [{ ...payment, dueLabel: ' =SUM(1,2)"', status: "overdue" }],
      [],
    );
    expect(csv).toContain('"\' =SUM(1,2)"""');
    expect(csv).toContain('"Overdue"');
    expect(csv).toContain('"Not available"');
    expect(csv).toContain("\r\n");
  });
});

describe("office navigation and file links", () => {
  it("preserves project scope and encodes residence route segments", () => {
    expect(villaHref(villa, "voortgang")).toBe(
      "/office/villas/A%2F03/voortgang?projectId=project-a",
    );
    expect(officeHref("payments", "a & b")).toBe(
      "/office/betalingen?projectId=a%20%26%20b",
    );
    expect(officeHref("documents", "")).toBe("/office/documenten");
  });

  it("permits HTTP(S) file links but never executable or embedded-credential URLs", () => {
    expect(safeFileUrl("https://files.vandertweel.nl/plans.pdf")).toBe(
      "https://files.vandertweel.nl/plans.pdf",
    );
    expect(safeFileUrl("javascript:alert(1)")).toBeNull();
    expect(safeFileUrl("https://user:password@files.example.org/a")).toBeNull();
    expect(safeFileUrl("https://files.example.org/plans.pdf")).toBeNull();
    expect(safeFileUrl("http://localhost/private.pdf")).toBeNull();
    expect(safeFileUrl(null)).toBeNull();
  });
});
