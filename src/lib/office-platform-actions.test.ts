import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/office-data", () => ({ getProjectsOverview: vi.fn(), getProjectDetail: vi.fn(), getVillaForOffice: vi.fn() }));
vi.mock("@/lib/office-actions", () => ({
  toggleProgressTaskAction: vi.fn(), markPaymentPaidAction: vi.fn(), createUpdateAction: vi.fn(), addFileAction: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getProjectDetail, getProjectsOverview, getVillaForOffice } from "@/lib/office-data";
import { addFileAction, createUpdateAction, markPaymentPaidAction, toggleProgressTaskAction } from "@/lib/office-actions";
import { addFileLink, publishUpdate, togglePayment, toggleProgress } from "./office-platform-actions";
import type { AddFileLinkInput, PublishUpdateInput } from "@/components/office-platform/types";

const date = new Date("2026-10-30T13:00:00Z");
const project = { id: "project-a", slug: "cemagi", name: "Cemagi Atelier", brandLocked: true, createdAt: date };
const villa = { id: "villa-a", projectId: project.id, code: "Villa 1", plotM2: null, builtM2: null,
  status: "building", model3dUrl: null, createdAt: date, typeLabel: null, outdoorM2: null,
  leaseYears: null, pricePackage: null, priceTotalUsd: null, buildStarted: null, handoverExpected: null };
const scope = { villaId: villa.id, villaCode: villa.code, projectId: project.id };
const updateInput: PublishUpdateInput = { ...scope, title: "Foundation", body: "Foundation completed.", category: "Construction" };
const fileInput: AddFileLinkInput = { ...scope, label: "Progress image", url: "https://files.example-cdn.com/photo.jpg", note: "Foundation", kind: "photo" };

function detail(): NonNullable<Awaited<ReturnType<typeof getVillaForOffice>>> {
  return { villa, project, buyerName: null, updates: [], files: [],
    tasks: [{ id: "task-a", villaId: villa.id, phase: "Foundation", percentWeight: "20", doneAt: null,
      doneBy: null, sequence: 1, detail: null, period: null }],
    milestones: [{ id: "payment-a", villaId: villa.id, percent: "10", dueLabel: "Foundation", status: "open",
      paidAt: null, sequence: 1, amountUsd: "15500", note: null, expectedAt: null }],
  };
}

function session(role = "developer") {
  vi.mocked(auth).mockResolvedValue({ user: { id: "account-a", role } } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  session();
  vi.mocked(getProjectsOverview).mockResolvedValue([{ ...project, villaCount: 1 }]);
  vi.mocked(getProjectDetail).mockResolvedValue({ project, villas: [{ ...villa, buyerName: null }] });
  vi.mocked(getVillaForOffice).mockResolvedValue(detail());
});

describe("office presentation action adapters", () => {
  it("rechecks the server session and never invokes existing actions for unauthorized roles", async () => {
    session("buyer");
    expect((await toggleProgress({ ...scope, taskId: "task-a", expectedDone: false })).ok).toBe(false);
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await publishUpdate(updateInput)).ok).toBe(false);
    expect(getProjectsOverview).not.toHaveBeenCalled();
    expect(toggleProgressTaskAction).not.toHaveBeenCalled();
    expect(createUpdateAction).not.toHaveBeenCalled();
  });

  it("blocks PM financial/file actions and non-construction update publishing", async () => {
    session("pm");
    expect((await togglePayment({ ...scope, milestoneId: "payment-a", expectedPaid: false })).ok).toBe(false);
    expect((await addFileLink(fileInput)).ok).toBe(false);
    expect((await publishUpdate({ ...updateInput, category: "Payment" })).ok).toBe(false);
    expect(getProjectsOverview).not.toHaveBeenCalled();
    expect(markPaymentPaidAction).not.toHaveBeenCalled();
    expect(addFileAction).not.toHaveBeenCalled();
    expect(createUpdateAction).not.toHaveBeenCalled();
  });

  it("permits an assigned PM to complete a task through the unchanged backend", async () => {
    session("pm");
    expect(await toggleProgress({ ...scope, taskId: "task-a", expectedDone: false })).toEqual({ ok: true });
    expect(toggleProgressTaskAction).toHaveBeenCalledWith("task-a", "Villa 1");
    expect(getVillaForOffice).toHaveBeenCalledWith("account-a", "pm", "Villa 1");
    expect(revalidatePath).toHaveBeenCalledWith("/(office)", "layout");
  });

  it("refuses a stale task status rather than accidentally undoing another user's change", async () => {
    const data = detail();
    data.tasks[0].doneAt = date;
    vi.mocked(getVillaForOffice).mockResolvedValue(data);
    const output = await toggleProgress({ ...scope, taskId: "task-a", expectedDone: false });
    expect(output).toMatchObject({ ok: false, error: expect.stringContaining("changed") });
    expect(toggleProgressTaskAction).not.toHaveBeenCalled();
  });

  it("verifies task/payment association independently of caller-provided record IDs", async () => {
    const data = detail();
    data.tasks[0].villaId = "villa-b";
    data.milestones![0].villaId = "villa-b";
    vi.mocked(getVillaForOffice).mockResolvedValue(data);
    expect((await toggleProgress({ ...scope, taskId: "task-a", expectedDone: false })).ok).toBe(false);
    expect((await togglePayment({ ...scope, milestoneId: "payment-a", expectedPaid: false })).ok).toBe(false);
    expect(toggleProgressTaskAction).not.toHaveBeenCalled();
    expect(markPaymentPaidAction).not.toHaveBeenCalled();
  });

  it("rejects changed villa/project identity and ambiguous codes before writing", async () => {
    expect((await publishUpdate({ ...updateInput, villaId: "villa-b" })).ok).toBe(false);
    expect((await publishUpdate({ ...updateInput, projectId: "project-b" })).ok).toBe(false);
    vi.mocked(getProjectDetail).mockResolvedValue({ project, villas: [
      { ...villa, buyerName: null }, { ...villa, id: "villa-b", buyerName: null },
    ] });
    expect((await publishUpdate(updateInput)).ok).toBe(false);
    expect(createUpdateAction).not.toHaveBeenCalled();
  });

  it("rechecks the result of code-based lookup against the displayed villa", async () => {
    const data = detail();
    data.villa = { ...villa, id: "villa-b" };
    vi.mocked(getVillaForOffice).mockResolvedValue(data);
    expect((await addFileLink(fileInput)).ok).toBe(false);
    expect(addFileAction).not.toHaveBeenCalled();
  });

  it("forwards only existing publish fields with no role/account spoofing", async () => {
    session("pm");
    expect(await publishUpdate(updateInput)).toEqual({ ok: true });
    const form = vi.mocked(createUpdateAction).mock.calls[0][0];
    expect(Object.fromEntries(form)).toEqual({ villaCode: "Villa 1", title: "Foundation",
      body: "Foundation completed.", category: "Construction" });
  });

  it("forwards valid link-only file records and never treats them as an upload", async () => {
    expect(await addFileLink(fileInput)).toEqual({ ok: true });
    expect(Object.fromEntries(vi.mocked(addFileAction).mock.calls[0][0])).toEqual({
      villaCode: "Villa 1", label: "Progress image", url: "https://files.example-cdn.com/photo.jpg", note: "Foundation", kind: "photo",
    });
  });

  it("rejects unsafe URLs, embedded credentials, unknown file kinds and oversized forms", async () => {
    for (const url of ["javascript:alert(1)", "data:text/html,hello", "https://user:password@example.com/private", "not a url", "https://example.com/file.pdf", "http://localhost/file.pdf", "https://files.example/file.pdf", "https://files.test/file.pdf", "https://files.invalid/file.pdf"]) {
      expect((await addFileLink({ ...fileInput, url })).ok).toBe(false);
    }
    expect((await addFileLink({ ...fileInput, kind: "other" } as unknown as AddFileLinkInput)).ok).toBe(false);
    expect((await publishUpdate({ ...updateInput, title: "a".repeat(201) })).ok).toBe(false);
    expect((await publishUpdate({ ...updateInput, body: "  " })).ok).toBe(false);
    expect((await publishUpdate(null as unknown as PublishUpdateInput)).ok).toBe(false);
    expect(addFileAction).not.toHaveBeenCalled();
    expect(createUpdateAction).not.toHaveBeenCalled();
  });

  it("returns an honest refresh-first error without leaking internal error text or promising delivery", async () => {
    vi.mocked(createUpdateAction).mockRejectedValue(new Error("SECRET_DATABASE_DETAILS"));
    const output = await publishUpdate(updateInput);
    expect(output).toMatchObject({ ok: false, error: expect.stringContaining("Refresh") });
    expect(JSON.stringify(output)).not.toContain("SECRET");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("marks payment through existing action, preserving its existing notification contract", async () => {
    expect(await togglePayment({ ...scope, milestoneId: "payment-a", expectedPaid: false })).toEqual({ ok: true });
    expect(markPaymentPaidAction).toHaveBeenCalledWith("payment-a", "Villa 1");
    const data = detail();
    data.milestones![0].status = "paid";
    vi.mocked(getVillaForOffice).mockResolvedValue(data);
    expect((await togglePayment({ ...scope, milestoneId: "payment-a", expectedPaid: false })).ok).toBe(false);
    expect(markPaymentPaidAction).toHaveBeenCalledTimes(1);
  });
});
