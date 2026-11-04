import { z } from "zod";

// Integer cents and basis points are the only arithmetic units. Persisted USD
// strings are parsed without floating point multiplication or implicit rounding.
export const MAX_CENTS = 2_000_000_000;
export function parseCents(value: string): number {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) throw new Error("Enter an amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents < 1 || cents > MAX_CENTS) throw new Error("Amount must be positive and no more than USD 20,000,000.");
  return cents;
}
export function centsToUsd(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid amount in cents.");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
export function percentToBasisPoints(value: string): number {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(value)) throw new Error("Percentages need at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const points = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (points < 1 || points > 10_000) throw new Error("Every percentage must be greater than 0 and at most 100.");
  return points;
}
export type ScheduleStep = { label: string; percent: string; dueDays: number };
export const scheduleInput = z.object({
  name: z.string().trim().min(1).max(120),
  steps: z.array(z.object({ label: z.string().trim().min(1).max(120), percent: z.string(), dueDays: z.number().int().min(0).max(3650) })).min(1).max(36),
});
export function validateSchedule(steps: ScheduleStep[]): number[] {
  const points = steps.map((step) => percentToBasisPoints(step.percent));
  if (points.reduce((sum, point) => sum + point, 0) !== 10_000) throw new Error("Payment schedule must total exactly 100%.");
  if (steps.some((step, i) => i > 0 && step.dueDays < steps[i - 1].dueDays)) throw new Error("Payment dates must follow schedule order.");
  return points;
}
/** Largest remainder allocation preserves the exact villa total, including odd
 * cents. Ties resolve in schedule order, so repeated application is stable. */
export function allocateCents(total: number, steps: ScheduleStep[]): number[] {
  if (!Number.isSafeInteger(total) || total <= 0 || total > MAX_CENTS) throw new Error("Invalid villa total.");
  const points = validateSchedule(steps);
  const amounts = points.map((point) => Math.floor(total * point / 10_000));
  const order = points.map((point, index) => ({ index, remainder: total * point % 10_000 })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const remainder = total - amounts.reduce((sum, amount) => sum + amount, 0);
  for (let i = 0; i < remainder; i++) amounts[order[i].index]++;
  if (amounts.some((amount) => amount < 1)) throw new Error("Villa total is too small for these payment steps.");
  return amounts;
}
const cleanText = (maximum: number) => z.string().trim().min(1).max(maximum).refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value), "Unsupported control characters.");
export const issuerInput = z.object({ companyName: cleanText(200), address: cleanText(1500), email: z.email().max(320), registrationNumber: z.string().trim().max(120).default(""), taxNumber: z.string().trim().max(120).default(""), bankInstructions: cleanText(2000), invoicePrefix: z.string().regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/).default("INV") });
export const recipientInput = z.object({ name: cleanText(200), address: cleanText(1500), email: z.email().max(320) });
export type BillingSnapshot = {
  version: 1; documentKind: "invoice" | "receipt"; number: string; issuedAt: string; dueAt: string;
  issuer: z.infer<typeof issuerInput>; recipient: z.infer<typeof recipientInput>;
  projectName: string; villaCode: string; description: string; percent: string; amountCents: number; currency: "USD";
  payment?: { id: string; reference: string; paidAt: string; invoiceNumber: string };
};
export type BillingStatus = "draft" | "planned" | "next" | "invoiced" | "paid" | "overdue";
export function deriveBillingStatus(input: { paid: boolean; invoiced: boolean; amount: string | null; dueAt: Date | null; next: boolean }, now = new Date()): BillingStatus {
  if (input.paid) return "paid";
  if (input.invoiced) return input.dueAt && input.dueAt.toISOString().slice(0, 10) < now.toISOString().slice(0, 10) ? "overdue" : "invoiced";
  if (!input.amount || !input.dueAt) return "draft";
  return input.next ? "next" : "planned";
}
export function dateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose a valid date.");
  const date = new Date(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Choose a valid date.");
  return date;
}
