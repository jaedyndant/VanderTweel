import { describe, expect, it } from "vitest";
import {
  csvCell,
  milestoneAmount,
  paymentSummary,
  safeDocumentUrl,
} from "./presentation";
import type { ClientMilestone } from "./types";

const milestone = (
  overrides: Partial<ClientMilestone> = {},
): ClientMilestone => ({
  id: "one",
  percent: 10,
  dueLabel: "Reservation",
  status: "paid",
  paidAt: null,
  sequence: 1,
  amountUsd: null,
  note: null,
  expectedAt: null,
  ...overrides,
});

describe("buyer payment presentation", () => {
  it("prefers an actual ledger amount over a percentage estimate", () => {
    expect(milestoneAmount(milestone({ amountUsd: 150 }), 2000)).toBe(150);
  });
  it("only derives a missing amount when the contract value is known", () => {
    expect(milestoneAmount(milestone(), 155000)).toBe(15500);
    expect(milestoneAmount(milestone(), null)).toBeNull();
  });
  it("does not silently count unknown paid amounts as zero", () => {
    const result = paymentSummary(
      [milestone(), milestone({ id: "two", amountUsd: 50 })],
      null,
    );
    expect(result.paid).toBeNull();
    expect(result.remaining).toBeNull();
  });
  it("keeps an empty ledger unknown rather than displaying a zero balance", () => {
    expect(paymentSummary([], 155000).paid).toBeNull();
    expect(paymentSummary([], 155000).percent).toBeNull();
  });
  it("computes recorded payments independently of construction", () => {
    const result = paymentSummary(
      [
        milestone({ percent: 30, amountUsd: 46500 }),
        milestone({
          id: "two",
          percent: 70,
          status: "open",
          amountUsd: 108500,
        }),
      ],
      155000,
    );
    expect(result).toMatchObject({
      paid: 46500,
      remaining: 108500,
      percent: 30,
      paidCount: 1,
    });
  });
});

describe("buyer file and CSV presentation", () => {
  it("rejects active URLs and placeholder records", () => {
    expect(safeDocumentUrl("javascript:alert(1)")).toBeNull();
    expect(safeDocumentUrl("https://files.example/contract.pdf")).toBeNull();
    expect(safeDocumentUrl("https://example.com/villa.pdf")).toBeNull();
    expect(
      safeDocumentUrl("https://storage.example.net/contract.pdf"),
    ).toBeNull();
    expect(safeDocumentUrl("https://files.vandertweel.com/villa.pdf")).toBe(
      "https://files.vandertweel.com/villa.pdf",
    );
  });
  it("quotes CSV and neutralizes spreadsheet formulas in user-controlled labels", () => {
    expect(csvCell('A, "B"')).toBe('"A, ""B"""');
    expect(csvCell(" =SUM(1,2)")).toBe('"\' =SUM(1,2)"');
    expect(csvCell("\t@SUM(1,2)")).toBe('"\'\t@SUM(1,2)"');
    expect(csvCell(15500)).toBe('"15500"');
  });
});
