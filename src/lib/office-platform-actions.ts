"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { safeDocumentUrl } from "@/components/client-platform/presentation";
import {
  addFileAction,
  createUpdateAction,
  markPaymentPaidAction,
  toggleProgressTaskAction,
} from "@/lib/office-actions";
import {
  getProjectDetail,
  getProjectsOverview,
  getVillaForOffice,
} from "@/lib/office-data";
import type {
  AddFileLinkInput,
  OfficeActionResult,
  OfficeRecordScope,
  OfficeRole,
  PublishUpdateInput,
  TogglePaymentInput,
  ToggleProgressInput,
} from "@/components/office-platform/types";

class InputError extends Error {}

function text(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== "string") throw new InputError(`${label} is invalid.`);
  const result = value.trim();
  if (required && !result) throw new InputError(`${label} is required.`);
  if (result.length > max) throw new InputError(`${label} is too long (maximum ${max} characters).`);
  return result;
}

function object(input: unknown): asserts input is Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new InputError("The submitted form is invalid.");
}

async function officeSession(developerOnly = false): Promise<{ id: string; role: OfficeRole }> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== "developer" && user.role !== "pm")) {
    throw new InputError("Your session has expired. Sign in and try again.");
  }
  if (developerOnly && user.role !== "developer") throw new InputError("This action is available to the developer only.");
  return { id: user.id, role: user.role };
}

/**
 * Existing actions resolve a villa by code. Pin that code to the exact villa
 * and project displayed by this frontend before invoking their unchanged
 * authorization/mutation flow. Never trust caller-supplied role or ownership.
 */
async function scopedVilla(user: { id: string; role: OfficeRole }, input: OfficeRecordScope) {
  const villaId = text(input.villaId, "Villa", 120);
  const villaCode = text(input.villaCode, "Villa code", 20);
  const projectId = text(input.projectId, "Project", 120);
  const projects = await getProjectsOverview(user.id, user.role);
  const matchingProjects = projects.filter((project) => project.id === projectId);
  if (matchingProjects.length !== 1) throw new InputError("This villa is no longer available to your account. Refresh the page.");
  const project = await getProjectDetail(user.id, user.role, matchingProjects[0].slug);
  const matchingVillas = project?.villas.filter((villa) => villa.code === villaCode) ?? [];
  if (!project || project.project.id !== projectId || matchingVillas.length !== 1 ||
      matchingVillas[0].id !== villaId || matchingVillas[0].projectId !== projectId) {
    throw new InputError("The villa selection has changed. Refresh the page before saving.");
  }
  const detail = await getVillaForOffice(user.id, user.role, villaCode);
  if (!detail || detail.villa.id !== villaId || detail.villa.code !== villaCode ||
      detail.villa.projectId !== projectId || detail.project?.id !== projectId) {
    throw new InputError("The villa selection has changed. Refresh the page before saving.");
  }
  return detail;
}

async function result(operation: () => Promise<void>): Promise<OfficeActionResult> {
  try {
    await operation();
    // New aggregate pages are not covered by the original villa-only paths.
    revalidatePath("/(office)", "layout");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof InputError
        ? error.message
        : "The save could not be confirmed. Refresh the page before trying again.",
    };
  }
}

export async function toggleProgress(input: ToggleProgressInput): Promise<OfficeActionResult> {
  return result(async () => {
    object(input);
    const taskId = text(input.taskId, "Progress task", 120);
    if (typeof input.expectedDone !== "boolean") throw new InputError("The progress status is invalid.");
    const user = await officeSession();
    const detail = await scopedVilla(user, input);
    const tasks = detail.tasks.filter((task) => task.id === taskId && task.villaId === detail.villa.id);
    if (tasks.length !== 1) throw new InputError("This task is no longer available. Refresh the page.");
    if (Boolean(tasks[0].doneAt) !== input.expectedDone) throw new InputError("This task has changed. Refresh the page before saving.");
    await toggleProgressTaskAction(taskId, detail.villa.code);
  });
}

export async function togglePayment(input: TogglePaymentInput): Promise<OfficeActionResult> {
  return result(async () => {
    object(input);
    const milestoneId = text(input.milestoneId, "Payment milestone", 120);
    if (typeof input.expectedPaid !== "boolean") throw new InputError("The payment status is invalid.");
    const user = await officeSession(true);
    const detail = await scopedVilla(user, input);
    const payments = detail.milestones?.filter((payment) => payment.id === milestoneId && payment.villaId === detail.villa.id) ?? [];
    if (payments.length !== 1) throw new InputError("This payment is no longer available. Refresh the page.");
    if ((payments[0].status === "paid") !== input.expectedPaid) throw new InputError("This payment has changed. Refresh the page before saving.");
    await markPaymentPaidAction(milestoneId, detail.villa.code);
  });
}

export async function publishUpdate(input: PublishUpdateInput): Promise<OfficeActionResult> {
  return result(async () => {
    object(input);
    const title = text(input.title, "Title", 200, false);
    const body = text(input.body, "Update", 10000);
    const category = text(input.category, "Category", 40);
    if (!["Construction", "Payment", "Paperwork"].includes(category)) throw new InputError("Choose a valid update category.");
    const user = await officeSession();
    if (user.role === "pm" && category !== "Construction") throw new InputError("Project managers can publish construction updates only.");
    const detail = await scopedVilla(user, input);
    const form = new FormData();
    form.set("villaCode", detail.villa.code);
    form.set("title", title);
    form.set("body", body);
    form.set("category", category);
    await createUpdateAction(form);
  });
}

export async function addFileLink(input: AddFileLinkInput): Promise<OfficeActionResult> {
  return result(async () => {
    object(input);
    const label = text(input.label, "File name", 200);
    const rawUrl = text(input.url, "File URL", 2048);
    const note = text(input.note, "Note", 2000, false);
    if (input.kind !== "doc" && input.kind !== "photo") throw new InputError("Choose document or photo.");
    const url = safeDocumentUrl(rawUrl);
    if (!url) throw new InputError("Enter a valid HTTP or HTTPS file URL without credentials or a placeholder domain.");
    const user = await officeSession(true);
    const detail = await scopedVilla(user, input);
    const form = new FormData();
    form.set("villaCode", detail.villa.code);
    form.set("label", label);
    form.set("url", url);
    form.set("note", note);
    form.set("kind", input.kind);
    await addFileAction(form);
  });
}
