import { z } from "zod";

export class ManagementError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

const uuid = z.uuid();
const ids = z.array(uuid).max(100).transform((items) => [...new Set(items)].sort());
export const invitationSchema = z.object({
  requestId: uuid,
  email: z.string().trim().toLowerCase().email().max(320),
  role: z.enum(["buyer", "pm"]),
  name: z.string().trim().min(1).max(200),
  villaIds: ids.default([]),
  projectIds: ids.default([]),
  allowSharedVilla: z.boolean().default(false),
}).strict().superRefine((input, context) => {
  if (input.role === "buyer" && (!input.villaIds.length || input.projectIds.length)) {
    context.addIssue({ code: "custom", message: "Choose at least one villa for a buyer and no PM projects." });
  }
  if (input.role === "pm" && (!input.projectIds.length || input.villaIds.length)) {
    context.addIssue({ code: "custom", message: "Choose at least one project for a PM and no buyer villas." });
  }
});

export const resendSchema = z.object({ requestId: uuid, accountId: uuid }).strict();

const decimal = (max: number) => z.union([z.string(), z.number(), z.null()])
  .transform((value) => value === null || String(value).trim() === "" ? null : String(value).trim())
  .refine((value) => value === null || (/^\d{1,10}(?:\.\d{1,2})?$/.test(value) && Number(value) <= max), "Enter a positive number with at most two decimal places.");
const optionalText = (max: number) => z.string().trim().max(max).nullable().transform((value) => value || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().refine((value) => !value || (!Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), "Enter a valid date.");
export const villaInputSchema = z.object({
  requestId: uuid,
  id: uuid.optional(),
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  projectId: uuid,
  code: z.string().trim().min(1).max(20).regex(/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/, "Use letters, numbers, spaces, hyphens or underscores for the villa code."),
  status: z.enum(["planned", "on_schedule", "in_build", "in_progress", "delayed", "completed", "complete", "available", "reserved", "sold"]),
  typeLabel: optionalText(80),
  plotM2: decimal(999999.99),
  builtM2: decimal(999999.99),
  outdoorM2: decimal(999999.99),
  leaseYears: z.number().int().min(1).max(999).nullable(),
  pricePackage: optionalText(60),
  priceTotalUsd: decimal(9999999999.99),
  buildStarted: date,
  handoverExpected: date,
}).strict().superRefine((input, context) => {
  if (input.id && !input.expectedRevision) context.addIssue({ code: "custom", message: "Refresh the villa before editing it." });
  if (input.buildStarted && input.handoverExpected && input.handoverExpected < input.buildStarted) context.addIssue({ code: "custom", message: "Expected handover must not be before construction starts." });
});

export function parseManagementInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ManagementError(result.error.issues[0]?.message || "The submitted form is invalid.");
  return result.data;
}

export function requireDeveloper(actor: { id: string; role: string }) {
  if (actor.role !== "developer") throw new ManagementError("Only the developer can manage accounts and residences.", 403);
}

export function ensureCompatibleRole(existingRole: string | undefined, requestedRole: "buyer" | "pm") {
  if (existingRole && existingRole !== requestedRole) throw new ManagementError("This email already belongs to a different account role. No permissions have been changed.", 409);
}

export const INVITE_COOLDOWN_MS = 15 * 60 * 1000;
export function ensureInviteCooldown(lastRequestedAt: Date | undefined, now: Date) {
  if (lastRequestedAt && now.getTime() - lastRequestedAt.getTime() < INVITE_COOLDOWN_MS) {
    throw new ManagementError("An invitation was already requested recently. Wait 15 minutes before sending another.", 429);
  }
}

export function requireExactSelection(requested: string[], existing: string[]) {
  const found = new Set(existing);
  if (requested.some((id) => !found.has(id))) throw new ManagementError("An assigned villa or project no longer exists. Refresh and check your selection.", 409);
}

export function requireUnsharedSelection(otherBuyerIds: string[], allowSharedVilla: boolean) {
  if (otherBuyerIds.length && !allowSharedVilla) throw new ManagementError("A selected villa already has another buyer. Confirm shared access before adding a co-owner.", 409);
}
