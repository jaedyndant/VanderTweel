import { describe, expect, it } from "vitest";
import { allocateCents, centsToUsd, dateOnly, deriveBillingStatus, issuerInput, parseCents, percentToBasisPoints, validateSchedule, type ScheduleStep } from "./domain";

const steps: ScheduleStep[] = [{ label: "Contract", percent: "33.33", dueDays: 0 }, { label: "Construction", percent: "33.33", dueDays: 60 }, { label: "Handover", percent: "33.34", dueDays: 120 }];
describe("exact contractual money", () => {
  it("parses decimal strings without floating-point rounding", () => {
    expect(parseCents("0.29")).toBe(29); expect(parseCents("168000.01")).toBe(16_800_001); expect(parseCents("1.1")).toBe(110); expect(centsToUsd(16_800_001)).toBe("168000.01");
  });
  it.each(["0", "-1", "0.001", "1e3", "NaN", "Infinity", " 12", "12 ", "2,000", "20000000.01"])("rejects unsafe or ambiguous amount %s", (value) => expect(() => parseCents(value)).toThrow());
  it("allocates every cent exactly and deterministically", () => {
    expect(allocateCents(100, steps)).toEqual([33, 33, 34]);
    const split = [{ label: "One", percent: "50", dueDays: 0 }, { label: "Two", percent: "50", dueDays: 1 }];
    expect(allocateCents(101, split)).toEqual([51, 50]);
    for (const total of [3, 101, 29_900_001, 2_000_000_000]) expect(allocateCents(total, steps).reduce((sum, amount) => sum + amount, 0)).toBe(total);
  });
  it("requires a precisely complete, ordered and positive schedule", () => {
    expect(percentToBasisPoints("33.33")).toBe(3333);
    expect(validateSchedule(steps)).toEqual([3333, 3333, 3334]);
    expect(() => validateSchedule([{ ...steps[0], percent: "99.99" }])).toThrow(/100%/);
    expect(() => validateSchedule([{ ...steps[0], percent: "100.01" }])).toThrow();
    expect(() => validateSchedule([{ ...steps[0], percent: "0" }])).toThrow();
    expect(() => validateSchedule([{ ...steps[0], percent: "0.001" }])).toThrow();
    expect(() => validateSchedule([steps[2], steps[0], steps[1]])).toThrow(/order/);
    expect(() => allocateCents(1, steps)).toThrow(/too small/);
  });
});
describe("truthful payment states", () => {
  const now = new Date("2026-11-04T14:00:00Z");
  const base = { paid: false, invoiced: false, amount: "1000.00", dueAt: new Date("2026-11-05T12:00:00Z"), next: false };
  it("does not claim that a future planned payment is an invoice", () => { expect(deriveBillingStatus(base, now)).toBe("planned"); expect(deriveBillingStatus({ ...base, next: true }, now)).toBe("next"); });
  it("uses draft for incomplete schedules", () => { expect(deriveBillingStatus({ ...base, amount: null }, now)).toBe("draft"); expect(deriveBillingStatus({ ...base, dueAt: null }, now)).toBe("draft"); });
  it("calls only issued unpaid invoices overdue", () => { const dueAt = new Date("2026-10-30T12:00:00Z"); expect(deriveBillingStatus({ ...base, dueAt }, now)).toBe("planned"); expect(deriveBillingStatus({ ...base, dueAt, invoiced: true }, now)).toBe("overdue"); expect(deriveBillingStatus({ ...base, invoiced: true }, now)).toBe("invoiced"); });
  it("does not mark an invoice overdue before its due calendar day has ended", () => expect(deriveBillingStatus({ ...base, invoiced: true, dueAt: new Date("2026-11-04T00:00:00Z") }, now)).toBe("invoiced"));
  it("preserves historical paid steps without inventing invoices", () => expect(deriveBillingStatus({ ...base, paid: true, amount: null, dueAt: null }, now)).toBe("paid"));
});
describe("document source validation", () => {
  it("rejects impossible dates rather than letting JS roll into the next month", () => { expect(() => dateOnly("2026-02-30")).toThrow(); expect(() => dateOnly("2026-13-01")).toThrow(); expect(() => dateOnly("2026-2-01")).toThrow(); expect(dateOnly("2028-02-29").toISOString()).toBe("2028-02-29T12:00:00.000Z"); });
  it("requires real issuer details and payment instructions", () => {
    const actual = { companyName: "Example issuer", address: "Provided billing address", email: "billing@example.test", bankInstructions: "Provided bank and account", invoicePrefix: "INV" };
    expect(issuerInput.parse(actual).taxNumber).toBe("");
    expect(issuerInput.safeParse({ ...actual, bankInstructions: "" }).success).toBe(false);
    expect(issuerInput.safeParse({ ...actual, address: "" }).success).toBe(false);
    expect(issuerInput.safeParse({ ...actual, invoicePrefix: "../../etc" }).success).toBe(false);
  });
});
