import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/platform-access", () => ({
  requireActor: vi.fn(), assertScope: vi.fn(),
  AccessError: class AccessError extends Error { constructor(message = "Access denied.", public status = 403) { super(message); } },
}));
vi.mock("@/lib/platform-events", () => ({ writePlatformEvent: vi.fn() }));
vi.mock("@/lib/platform-communication", () => ({ publishTeamMessage: vi.fn() }));
vi.mock("@/lib/mail-outbox", () => ({ dispatchMailOutbox: vi.fn() }));
vi.mock("@/lib/billing/service", () => ({ markBillingMilestonePaid: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { transaction: vi.fn(), select: vi.fn() } }));

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { progressTask, villa as villaTable } from "@/db/schema";
import { requireActor, assertScope, AccessError } from "@/lib/platform-access";
import { writePlatformEvent } from "@/lib/platform-events";
import { publishTeamMessage } from "@/lib/platform-communication";
import { dispatchMailOutbox } from "@/lib/mail-outbox";
import { markBillingMilestonePaid } from "@/lib/billing/service";
import { addFileAction, createUpdateAction, markPaymentPaidAction, toggleProgressTaskAction } from "./office-actions";

const taskId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const developer = { id: "33333333-3333-4333-8333-333333333333", role: "developer" as const, email: "dev@example.test", displayName: "Developer" };
const villa = { id: "44444444-4444-4444-8444-444444444444", projectId: "55555555-5555-4555-8555-555555555555", code: "QA Villa" };
const task = { id: taskId, villaId: villa.id, phase: "Foundation", doneAt: null as Date | null, doneBy: null as string | null };
let taskRows: Array<typeof task>;
let villaRows: Array<typeof villa>;
const rowLock = vi.fn();
const writeWhere = vi.fn();
const set = vi.fn();
const tx = { select: vi.fn(), update: vi.fn() };
function select(table: unknown) {
  return { where: vi.fn(() => {
    const rows = table === villaTable ? villaRows : taskRows;
    return Object.assign(Promise.resolve(rows), { for: (mode: string) => { rowLock(mode); return Promise.resolve(rows); } });
  }) };
}
function form(fields: Record<string, string> = {}) {
  const result = new FormData();
  Object.entries({ villaCode: villa.code, requestId, title: "Foundation update", body: "Synthetic QA update body", category: "Construction", ...fields }).forEach(([key, value]) => result.set(key, value));
  return result;
}
beforeEach(() => {
  vi.resetAllMocks(); taskRows = [{ ...task }]; villaRows = [{ ...villa }];
  vi.mocked(requireActor).mockResolvedValue(developer);
  vi.mocked(assertScope).mockResolvedValue({ project: { id: villa.projectId }, villa } as never);
  tx.select.mockImplementation(() => ({ from: select }));
  vi.mocked(db.select).mockImplementation(() => ({ from: select }) as never);
  set.mockReturnValue({ where: writeWhere }); writeWhere.mockResolvedValue(undefined);
  tx.update.mockReturnValue({ set });
  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(tx as never));
  vi.mocked(markBillingMilestonePaid).mockRejectedValue(new Error("Use Billing to issue the invoice and record the payment amount, date and bank reference."));
});

describe("progress action — transactional compare-and-set boundary", () => {
  it.each([
    { expectedDone: false, doneAt: null, action: "progress.mark_done" },
    { expectedDone: true, doneAt: new Date("2026-11-04T08:00:00Z"), action: "progress.reopen" },
  ])("records $action with the same transaction and schedules delivery only after success", async ({ expectedDone, doneAt, action }) => {
    const pm = { ...developer, role: "pm" as const };
    vi.mocked(requireActor).mockResolvedValue(pm);
    taskRows = [{ ...task, doneAt }];
    await toggleProgressTaskAction(taskId, villa.code, expectedDone);
    expect(assertScope).toHaveBeenCalledExactlyOnceWith(tx, pm, { projectId: villa.projectId, villaId: villa.id });
    expect(rowLock).toHaveBeenCalledExactlyOnceWith("update");
    expect(tx.update).toHaveBeenCalledExactlyOnceWith(progressTask);
    expect(set).toHaveBeenCalledExactlyOnceWith({ doneAt: expectedDone ? null : expect.any(Date), doneBy: expectedDone ? null : pm.id });
    expect(writePlatformEvent).toHaveBeenCalledExactlyOnceWith(tx, expect.objectContaining({ actorId: pm.id, projectId: villa.projectId, villaId: villa.id, action, targetId: taskId, notify: true, pmSafe: true, link: `/koper/voortgang?villa=${villa.id}` }));
    expect(after).toHaveBeenCalledTimes(1); expect(dispatchMailOutbox).not.toHaveBeenCalled();
    const callback = vi.mocked(after).mock.calls[0][0];
    if (typeof callback !== "function") throw new Error("Expected deferred delivery callback");
    await callback(); expect(dispatchMailOutbox).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/office", "layout"); expect(revalidatePath).toHaveBeenCalledWith("/koper", "layout");
  });
  it("refuses blind legacy toggles before starting a transaction", async () => {
    await expect(toggleProgressTaskAction(taskId, villa.code)).rejects.toThrow(/Refresh/);
    expect(db.transaction).not.toHaveBeenCalled(); expect(writePlatformEvent).not.toHaveBeenCalled();
  });
  it("rejects stale displayed state rather than undoing a concurrent user's change", async () => {
    taskRows = [{ ...task, doneAt: new Date() }];
    await expect(toggleProgressTaskAction(taskId, villa.code, false)).rejects.toMatchObject({ status: 409 });
    expect(tx.update).not.toHaveBeenCalled(); expect(writePlatformEvent).not.toHaveBeenCalled(); expect(after).not.toHaveBeenCalled();
  });
  it("rejects a task outside the scoped residence", async () => {
    taskRows = [];
    await expect(toggleProgressTaskAction(taskId, villa.code, false)).rejects.toThrow(/Access/);
    expect(tx.update).not.toHaveBeenCalled(); expect(writePlatformEvent).not.toHaveBeenCalled();
  });
  it("rejects a project that the PM no longer manages", async () => {
    vi.mocked(assertScope).mockRejectedValue(new AccessError());
    await expect(toggleProgressTaskAction(taskId, villa.code, false)).rejects.toThrow(/Access/);
    expect(tx.update).not.toHaveBeenCalled(); expect(rowLock).not.toHaveBeenCalled();
  });
  it("fails the transaction if audit/outbox persistence fails, without scheduling delivery or reporting success", async () => {
    vi.mocked(writePlatformEvent).mockRejectedValue(new Error("Outbox insert failed"));
    await expect(toggleProgressTaskAction(taskId, villa.code, false)).rejects.toThrow("Outbox insert failed");
    expect(db.transaction).toHaveBeenCalledTimes(1); expect(after).not.toHaveBeenCalled(); expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("does not create an event if the state update fails", async () => {
    writeWhere.mockRejectedValue(new Error("Write failed"));
    await expect(toggleProgressTaskAction(taskId, villa.code, false)).rejects.toThrow("Write failed");
    expect(writePlatformEvent).not.toHaveBeenCalled(); expect(after).not.toHaveBeenCalled();
  });
  it("rejects malformed task identifiers without querying a database", async () => {
    await expect(toggleProgressTaskAction("invalid", villa.code, false)).rejects.toThrow(); expect(db.transaction).not.toHaveBeenCalled();
  });
  it("never lets a buyer enter the progress mutation transaction", async () => {
    vi.mocked(requireActor).mockResolvedValue({ ...developer, role: "buyer" });
    await expect(toggleProgressTaskAction(taskId, villa.code, false)).rejects.toThrow(/Access/); expect(db.transaction).not.toHaveBeenCalled();
  });
});

describe("legacy actions delegate to the protected domain workflows", () => {
  it("routes payment attempts through billing and preserves the explicit-recording guard", async () => {
    await expect(markPaymentPaidAction(taskId, villa.code)).rejects.toThrow(/Use Billing/);
    expect(markBillingMilestonePaid).toHaveBeenCalledExactlyOnceWith(taskId, villa.code);
    expect(db.transaction).not.toHaveBeenCalled(); expect(tx.update).not.toHaveBeenCalled(); expect(writePlatformEvent).not.toHaveBeenCalled(); expect(after).not.toHaveBeenCalled();
  });
  it("preserves the domain authorization error for payments", async () => {
    vi.mocked(markBillingMilestonePaid).mockRejectedValue(new AccessError());
    await expect(markPaymentPaidAction(taskId, villa.code)).rejects.toThrow(/Access/); expect(tx.update).not.toHaveBeenCalled();
  });
  it("passes the stable update request id and authoritative residence to the transactional publisher", async () => {
    await createUpdateAction(form());
    expect(publishTeamMessage).toHaveBeenCalledExactlyOnceWith({ id: requestId, projectId: villa.projectId, villaId: villa.id, title: "Foundation update", body: "Synthetic QA update body", category: "Construction" });
    expect(after).toHaveBeenCalledTimes(1); expect(dispatchMailOutbox).not.toHaveBeenCalled();
  });
  it("does not bypass a failed publication or schedule direct delivery", async () => {
    vi.mocked(publishTeamMessage).mockRejectedValue(new AccessError());
    await expect(createUpdateAction(form())).rejects.toThrow(/Access/); expect(after).not.toHaveBeenCalled(); expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("refuses an update for an unknown villa before publication", async () => {
    villaRows = []; await expect(createUpdateAction(form())).rejects.toThrow(/Access/); expect(publishTeamMessage).not.toHaveBeenCalled();
  });
  it("blocks buyer use of the legacy update route", async () => {
    vi.mocked(requireActor).mockResolvedValue({ ...developer, role: "buyer" });
    await expect(createUpdateAction(form())).rejects.toThrow(/Access/); expect(db.select).not.toHaveBeenCalled(); expect(publishTeamMessage).not.toHaveBeenCalled();
  });
  it("refuses external file URLs even for a developer, guiding them to private uploads", async () => {
    await expect(addFileAction(form({ url: "https://files.example.test/private.pdf", kind: "doc" }))).rejects.toMatchObject({ status: 409, message: expect.stringContaining("private upload manager") });
    expect(requireActor).toHaveBeenCalledExactlyOnceWith(true); expect(db.transaction).not.toHaveBeenCalled(); expect(db.select).not.toHaveBeenCalled(); expect(writePlatformEvent).not.toHaveBeenCalled();
  });
  it("requires developer authorization even for the disabled external-file entry point", async () => {
    vi.mocked(requireActor).mockRejectedValue(new AccessError());
    await expect(addFileAction(form())).rejects.toThrow(/Access/); expect(requireActor).toHaveBeenCalledExactlyOnceWith(true);
  });
  it.each([() => toggleProgressTaskAction(taskId, villa.code, false), () => createUpdateAction(form()), () => addFileAction(form())])("never accesses writes when session authentication fails", async (run) => {
    vi.mocked(requireActor).mockRejectedValue(new AccessError("Sign in to continue.", 401));
    await expect(run()).rejects.toMatchObject({ status: 401 }); expect(db.transaction).not.toHaveBeenCalled(); expect(publishTeamMessage).not.toHaveBeenCalled(); expect(writePlatformEvent).not.toHaveBeenCalled();
  });
});
