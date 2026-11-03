import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/office-data", () => ({ getAuthorizedOfficeVilla: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyBuyersForVilla: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/db/client", () => ({
  db: {
    query: {
      progressTask: { findFirst: vi.fn() },
      paymentMilestone: { findFirst: vi.fn() },
    },
    update: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { file, paymentMilestone, progressTask, update } from "@/db/schema";
import { getAuthorizedOfficeVilla } from "@/lib/office-data";
import { notifyBuyersForVilla } from "@/lib/notify";
import { recordAudit } from "@/lib/audit";
import { addFileAction, createUpdateAction, markPaymentPaidAction, toggleProgressTaskAction } from "./office-actions";

const now = new Date("2026-11-03T13:30:00Z");
const villa = { id: "villa-a", code: "Villa 1" };
const task = { id: "task-a", villaId: villa.id, phase: "Foundation", doneAt: null, doneBy: null };
const milestone = { id: "payment-a", villaId: villa.id, status: "open", dueLabel: "Foundation", percent: "10", paidAt: null };
const scope = { villaId: villa.id, villaCode: villa.code };
const returning = vi.fn();
const set = vi.fn();
const values = vi.fn();

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ villaCode: villa.code, ...fields })) data.set(key, value);
  return data;
}

function updateForm() {
  return form({ title: "Private update title", body: "Private buyer update", category: "Construction" });
}

function fileForm() {
  return form({ kind: "doc", url: "https://files.test/private.pdf?token=private", label: "Private contract", note: "Private document note" });
}

const mutations = [
  { name: "progress", run: () => toggleProgressTaskAction(task.id, villa.code), targetId: task.id },
  { name: "payment", run: () => markPaymentPaidAction(milestone.id, villa.code), targetId: milestone.id },
  { name: "update", run: () => createUpdateAction(updateForm()), targetId: "inserted-update-a" },
  { name: "file", run: () => addFileAction(fileForm()), targetId: "inserted-file-a" },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "account-a", role: "developer" } } as never);
  vi.mocked(getAuthorizedOfficeVilla).mockResolvedValue(villa as never);
  vi.mocked(db.query.progressTask.findFirst).mockResolvedValue(task as never);
  vi.mocked(db.query.paymentMilestone.findFirst).mockResolvedValue(milestone as never);
  set.mockImplementation(() => ({ where: () => ({ returning }) }));
  values.mockImplementation(() => ({ returning }));
  vi.mocked(db.update).mockImplementation((table) => {
    returning.mockResolvedValue([{ id: table === progressTask ? task.id : milestone.id }]);
    return { set } as never;
  });
  vi.mocked(db.insert).mockImplementation((table) => {
    returning.mockResolvedValue([{ id: table === update ? "inserted-update-a" : "inserted-file-a" }]);
    return { values } as never;
  });
});

describe("back-office audit at the actual mutation boundary", () => {
  it.each([
    { previousStatus: "open", nextStatus: "paid", action: "payment.mark_paid", notify: true },
    { previousStatus: "paid", nextStatus: "open", action: "payment.reopen", notify: false },
  ])("records $action with the actual payment transition", async ({ previousStatus, nextStatus, action, notify }) => {
    vi.mocked(db.query.paymentMilestone.findFirst).mockResolvedValue({ ...milestone, status: previousStatus } as never);

    await markPaymentPaidAction(milestone.id, villa.code);

    expect(db.update).toHaveBeenCalledWith(paymentMilestone);
    expect(set).toHaveBeenCalledWith({ status: nextStatus, paidAt: notify ? expect.any(Date) : null });
    expect(recordAudit).toHaveBeenCalledExactlyOnceWith("account-a", action, milestone.id, {
      ...scope, previousStatus, nextStatus,
    });
    expect(notifyBuyersForVilla).toHaveBeenCalledTimes(notify ? 1 : 0);
  });

  it.each([
    { doneAt: null, previousStatus: "open", nextStatus: "done", action: "progress.mark_done", notify: true },
    { doneAt: now, previousStatus: "done", nextStatus: "open", action: "progress.reopen", notify: false },
  ])("records $action for a PM with the actual progress transition", async ({ doneAt, previousStatus, nextStatus, action, notify }) => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "pm-a", role: "pm" } } as never);
    vi.mocked(db.query.progressTask.findFirst).mockResolvedValue({ ...task, doneAt } as never);

    await toggleProgressTaskAction(task.id, villa.code);

    expect(db.update).toHaveBeenCalledWith(progressTask);
    expect(set).toHaveBeenCalledWith({ doneAt: notify ? expect.any(Date) : null, doneBy: notify ? "pm-a" : null });
    expect(recordAudit).toHaveBeenCalledExactlyOnceWith("pm-a", action, task.id, {
      ...scope, previousStatus, nextStatus,
    });
    expect(notifyBuyersForVilla).toHaveBeenCalledTimes(notify ? 1 : 0);
  });

  it("uses the inserted update's exact ID for audit and notification without logging its text", async () => {
    await createUpdateAction(updateForm());

    expect(db.insert).toHaveBeenCalledWith(update);
    expect(returning).toHaveBeenCalledWith({ id: update.id });
    expect(db.select).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledExactlyOnceWith("account-a", "update.create", "inserted-update-a", {
      ...scope, category: "Construction",
    });
    expect(notifyBuyersForVilla).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      villaId: villa.id, sourceType: "update", sourceId: "inserted-update-a",
      summary: expect.stringContaining("Private buyer update"),
    }));
    expect(JSON.stringify(vi.mocked(recordAudit).mock.calls)).not.toContain("Private");
  });

  it("uses the inserted file's exact ID rather than the villa ID or latest shared file", async () => {
    await addFileAction(fileForm());

    expect(db.insert).toHaveBeenCalledWith(file);
    expect(returning).toHaveBeenCalledWith({ id: file.id });
    expect(db.select).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledExactlyOnceWith("account-a", "file.share_link", "inserted-file-a", {
      ...scope, kind: "doc",
    });
    expect(notifyBuyersForVilla).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      villaId: villa.id, sourceType: "file", sourceId: "inserted-file-a",
    }));
    expect(JSON.stringify(vi.mocked(recordAudit).mock.calls)).not.toMatch(/private|Private/);
  });

  it.each(mutations)("records a successful $name write before a notification failure", async ({ run, targetId }) => {
    vi.mocked(notifyBuyersForVilla).mockRejectedValue(new Error("Notification persistence failed"));

    await expect(run()).rejects.toThrow("Notification persistence failed");

    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordAudit).mock.calls[0][2]).toBe(targetId);
    expect(vi.mocked(recordAudit).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(notifyBuyersForVilla).mock.invocationCallOrder[0]
    );
  });

  it.each(mutations)("does not write or audit $name without a back-office session", async ({ run }) => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "buyer-a", role: "buyer" } } as never);

    await expect(run()).rejects.toThrow("Not authorized");

    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
    expect(notifyBuyersForVilla).not.toHaveBeenCalled();
  });

  it.each(mutations)("does not write or audit $name for an unauthorized villa", async ({ run }) => {
    vi.mocked(getAuthorizedOfficeVilla).mockResolvedValue(null);

    await expect(run()).rejects.toThrow("Not authorized for this villa");

    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it.each(mutations)("does not audit $name when persistence fails", async ({ run }) => {
    returning.mockRejectedValueOnce(new Error("Write failed"));

    await expect(run()).rejects.toThrow("Write failed");

    expect(recordAudit).not.toHaveBeenCalled();
    expect(notifyBuyersForVilla).not.toHaveBeenCalled();
  });

  it.each(mutations)("does not audit $name when no row was written", async ({ run }) => {
    returning.mockResolvedValueOnce([]);

    await expect(run()).rejects.toThrow("could not be");

    expect(recordAudit).not.toHaveBeenCalled();
    expect(notifyBuyersForVilla).not.toHaveBeenCalled();
  });

  it("does not audit a payment or task belonging to another villa", async () => {
    vi.mocked(db.query.progressTask.findFirst).mockResolvedValue({ ...task, villaId: "villa-b" } as never);
    vi.mocked(db.query.paymentMilestone.findFirst).mockResolvedValue({ ...milestone, villaId: "villa-b" } as never);

    await expect(toggleProgressTaskAction(task.id, villa.code)).rejects.toThrow("does not belong");
    await expect(markPaymentPaidAction(milestone.id, villa.code)).rejects.toThrow("does not belong");

    expect(db.update).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("does not let a PM write or audit payments or files", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "pm-a", role: "pm" } } as never);

    await expect(markPaymentPaidAction(milestone.id, villa.code)).rejects.toThrow("Only the developer");
    await expect(addFileAction(fileForm())).rejects.toThrow("Only the developer");

    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });
});
