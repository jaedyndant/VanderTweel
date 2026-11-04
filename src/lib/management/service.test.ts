import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reads: [] as unknown[], returns: [] as unknown[],
  writes: [] as { table: unknown; values?: unknown; set?: unknown }[],
  committed: [] as { table: unknown; values?: unknown; set?: unknown }[],
  transaction: vi.fn(), select: vi.fn(), insert: vi.fn(), update: vi.fn(), execute: vi.fn(),
  mail: vi.fn(), event: vi.fn(), locks: [] as string[],
}));
vi.mock("@/db/client", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/mail-outbox", () => ({ queueDirectEmail: mocks.mail }));
vi.mock("@/lib/platform-events", () => ({ writePlatformEvent: mocks.event }));

import { account, buyer, buyerVilla } from "@/db/schema";
import { accountInvitation, managementRequest } from "@/db/management-schema";
import { inviteAccount, managedVilla, resendInvitation, saveVilla } from "./service";
import { invitationSchema } from "./validation";

const actor = { id: "11111111-1111-4111-8111-111111111111", role: "developer" };
const requestId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const villaId = "44444444-4444-4444-8444-444444444444";
const projectId = "55555555-5555-4555-8555-555555555555";
const buyerId = "66666666-6666-4666-8666-666666666666";
const invitationId = "77777777-7777-4777-8777-777777777777";
const user = { id: userId, email: "owner@example.org", role: "buyer", displayName: "Owner" };
const input = { requestId, email: user.email, name: "Owner", role: "buyer", villaIds: [villaId] };
const villa = { id: villaId, projectId, code: "Villa 04", status: "planned", typeLabel: null, plotM2: null, builtM2: "82.00", outdoorM2: null, leaseYears: 25, pricePackage: null, priceTotalUsd: "155000.00", buildStarted: null, handoverExpected: null, model3dUrl: null, createdAt: new Date() };
const tx = { select: mocks.select, insert: mocks.insert, update: mocks.update, execute: mocks.execute };

function selection() {
  const builder = {
    from: () => builder, where: () => builder, orderBy: () => builder,
    for: (mode: string) => { mocks.locks.push(mode); return builder; },
    then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
      if (!mocks.reads.length) return Promise.reject(new Error("Unexpected database read")).then(resolve, reject);
      return Promise.resolve(mocks.reads.shift()).then(resolve, reject);
    },
  };
  return builder;
}
function mutation(table: unknown) {
  const write: { table: unknown; values?: unknown; set?: unknown } = { table };
  mocks.writes.push(write);
  const builder = {
    values: (values: unknown) => { write.values = values; return builder; },
    set: (values: unknown) => { write.set = values; return builder; },
    where: () => builder, onConflictDoNothing: () => builder, onConflictDoUpdate: () => builder,
    returning: () => Promise.resolve(mocks.returns.shift() ?? []),
    then: (resolve: (value: unknown) => void) => Promise.resolve([]).then(resolve),
  };
  return builder;
}

beforeEach(() => {
  vi.resetAllMocks(); mocks.reads.length = 0; mocks.returns.length = 0; mocks.writes.length = 0; mocks.committed.length = 0; mocks.locks.length = 0;
  vi.stubEnv("APP_URL", "https://owners.example.org");
  mocks.select.mockImplementation(selection);
  mocks.insert.mockImplementation(mutation);
  mocks.update.mockImplementation(mutation);
  mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => {
    const result = await callback(tx);
    mocks.committed.push(...mocks.writes);
    return result;
  });
});

describe("management transactional provisioning", () => {
  it("rejects buyer/PM calls before any database write and rechecks stale developer sessions", async () => {
    for (const role of ["buyer", "pm"]) await expect(inviteAccount({ ...actor, role }, input)).rejects.toMatchObject({ status: 403 });
    expect(mocks.transaction).not.toHaveBeenCalled();
    mocks.reads.push([{ role: "pm" }]);
    await expect(inviteAccount(actor, input)).rejects.toMatchObject({ status: 403 });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("cannot overwrite an existing developer or PM identity with a buyer invitation", async () => {
    mocks.reads.push([{ role: "developer" }], [], [{ ...user, role: "developer" }]);
    await expect(inviteAccount(actor, input)).rejects.toMatchObject({ status: 409 });
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.mail).not.toHaveBeenCalled();
  });
  it("rejects a forged/missing villa before provisioning an account", async () => {
    mocks.reads.push([{ role: "developer" }], [], [], []);
    await expect(inviteAccount(actor, input)).rejects.toThrow("no longer exists");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("commits account, ownership, invitation, audit and queued mail in one transaction", async () => {
    mocks.reads.push([{ role: "developer" }], [], [], [villa], [], [], []);
    mocks.returns.push([user], [{ id: buyerId }], [{ id: invitationId }]);
    const result = await inviteAccount(actor, input);
    expect(result.state).toBe("queued");
    expect(mocks.committed.map((write) => write.table)).toEqual([account, buyer, buyerVilla, accountInvitation, managementRequest]);
    expect(mocks.mail).toHaveBeenCalledWith(tx, expect.objectContaining({ recipient: user.email, sourceId: invitationId, idempotencyKey: `invitation:${requestId}` }));
    expect(mocks.mail.mock.calls[0][1].text).toContain("https://owners.example.org/login");
    expect(mocks.mail.mock.calls[0][1].text).not.toContain("token=");
    expect(mocks.event).toHaveBeenCalledWith(tx, expect.objectContaining({ projectId, actorId: actor.id, notify: false, pmSafe: false }));
    expect(mocks.locks).toContain("update");
  });
  it("does not leave partial accounts/access when outbox insertion fails", async () => {
    mocks.reads.push([{ role: "developer" }], [], [], [villa], [], [], []);
    mocks.returns.push([user], [{ id: buyerId }], [{ id: invitationId }]);
    mocks.mail.mockRejectedValue(new Error("queue unavailable"));
    await expect(inviteAccount(actor, input)).rejects.toThrow("queue unavailable");
    expect(mocks.committed).toEqual([]);
    expect(mocks.event).not.toHaveBeenCalled();
  });
  it("requires explicit co-owner confirmation and rolls back provisional account creation", async () => {
    mocks.reads.push([{ role: "developer" }], [], [], [villa], [], [], [{ buyerId: "another-owner" }]);
    mocks.returns.push([user], [{ id: buyerId }]);
    await expect(inviteAccount(actor, input)).rejects.toThrow("shared access");
    expect(mocks.committed).toEqual([]); expect(mocks.mail).not.toHaveBeenCalled();
  });
  it("replays a successful request receipt without queuing a second email", async () => {
    const normalized = invitationSchema.parse(input);
    const result = { accountId: userId, state: "queued" };
    mocks.reads.push([{ role: "developer" }], [{ actorId: actor.id, kind: "account.invite", requestDigest: createHash("sha256").update(JSON.stringify(normalized)).digest("hex"), result }]);
    expect(await inviteAccount(actor, input)).toEqual(result);
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.mail).not.toHaveBeenCalled();
  });
  it("rejects idempotency-key reuse by another actor or a different payload", async () => {
    mocks.reads.push([{ role: "developer" }], [{ actorId: "different", kind: "account.invite", requestDigest: "wrong", result: {} }]);
    await expect(inviteAccount(actor, input)).rejects.toMatchObject({ status: 409 });
    expect(mocks.mail).not.toHaveBeenCalled();
  });
  it("does not resend during cooldown or alter roles/assignments in resend", async () => {
    mocks.reads.push([{ role: "developer" }], [], [user], [{ id: invitationId, lastRequestedAt: new Date() }]);
    await expect(resendInvitation(actor, { requestId, accountId: userId })).rejects.toMatchObject({ status: 429 });
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.mail).not.toHaveBeenCalled();
  });
  it("refuses stale villa saves and cross-project moves without touching related records", async () => {
    const values = { requestId, ...managedVilla(villa), expectedRevision: "a".repeat(64) };
    const { revision: _revision, ...valid } = values;
    mocks.reads.push([{ role: "developer" }], [], [{ id: projectId }], [villa]);
    await expect(saveVilla(actor, valid)).rejects.toThrow("changed while");
    expect(mocks.update).not.toHaveBeenCalled();
    mocks.reads.push([{ role: "developer" }], [], [{ id: userId }], [villa]);
    await expect(saveVilla(actor, { ...valid, projectId: userId, expectedRevision: managedVilla(villa).revision })).rejects.toThrow("cannot be moved");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
