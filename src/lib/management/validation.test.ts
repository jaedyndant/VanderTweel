import { describe, expect, it } from "vitest";
import {
  ensureCompatibleRole, ensureInviteCooldown, invitationSchema, parseManagementInput,
  requireDeveloper, requireExactSelection, requireUnsharedSelection, villaInputSchema,
} from "./validation";

const id = "22222222-2222-4222-8222-222222222222";
const requestId = "11111111-1111-4111-8111-111111111111";
const invitation = { requestId, email: " OWNER@EXAMPLE.ORG ", role: "buyer", name: "Owner", villaIds: [id] };
const residence = {
  requestId, projectId: id, code: "Villa 04", status: "planned", typeLabel: null,
  plotM2: null, builtM2: "82.35", outdoorM2: null, leaseYears: 25, pricePackage: null,
  priceTotalUsd: "155000.00", buildStarted: "2026-12-01", handoverExpected: "2027-06-01",
};

describe("management boundaries", () => {
  it("accepts only developer mutations and never lets invitations choose developer", () => {
    for (const role of ["buyer", "pm", "admin", ""]) expect(() => requireDeveloper({ id, role })).toThrow("developer");
    expect(() => requireDeveloper({ id, role: "developer" })).not.toThrow();
    expect(invitationSchema.safeParse({ ...invitation, role: "developer" }).success).toBe(false);
    expect(invitationSchema.safeParse({ ...invitation, actorId: id }).success).toBe(false);
  });
  it("normalizes emails and deduplicates assignments before provisioning", () => {
    const result = parseManagementInput(invitationSchema, { ...invitation, villaIds: [id, id] });
    expect(result.email).toBe("owner@example.org");
    expect(result.villaIds).toEqual([id]);
  });
  it("requires appropriate explicit assignments for both account roles", () => {
    expect(invitationSchema.safeParse({ ...invitation, villaIds: [] }).success).toBe(false);
    expect(invitationSchema.safeParse({ ...invitation, projectIds: [id] }).success).toBe(false);
    expect(invitationSchema.safeParse({ ...invitation, role: "pm" }).success).toBe(false);
    expect(invitationSchema.safeParse({ ...invitation, role: "pm", villaIds: [], projectIds: [id] }).success).toBe(true);
    expect(() => requireExactSelection([id], [])).toThrow("no longer exists");
  });
  it("does not overwrite a different existing role or share another owner's villa silently", () => {
    expect(() => ensureCompatibleRole("developer", "buyer")).toThrow("different account role");
    expect(() => ensureCompatibleRole("buyer", "pm")).toThrow("different account role");
    expect(() => ensureCompatibleRole("pm", "pm")).not.toThrow();
    expect(() => requireUnsharedSelection([id], false)).toThrow("shared access");
    expect(() => requireUnsharedSelection([id], true)).not.toThrow();
  });
  it("limits retries to one invitation per account per 15 minutes", () => {
    const now = new Date("2026-11-04T12:00:00Z");
    expect(() => ensureInviteCooldown(new Date("2026-11-04T11:59:59Z"), now)).toThrow("15 minutes");
    expect(() => ensureInviteCooldown(new Date("2026-11-04T11:45:00Z"), now)).not.toThrow();
  });
  it("keeps blank amounts unknown and rejects invalid dates, money and stale edits", () => {
    expect(villaInputSchema.parse({ ...residence, priceTotalUsd: "" }).priceTotalUsd).toBeNull();
    for (const priceTotalUsd of ["-1", "1.001", "1e6", "Infinity", "10000000000"]) expect(villaInputSchema.safeParse({ ...residence, priceTotalUsd }).success).toBe(false);
    expect(villaInputSchema.safeParse({ ...residence, buildStarted: "2026-02-30" }).success).toBe(false);
    expect(villaInputSchema.safeParse({ ...residence, handoverExpected: "2026-01-01" }).success).toBe(false);
    expect(villaInputSchema.safeParse({ ...residence, id }).success).toBe(false);
    expect(villaInputSchema.safeParse({ ...residence, code: "../../office" }).success).toBe(false);
  });
});
