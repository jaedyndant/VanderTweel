"use server";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { progressTask, villa } from "@/db/schema";
import { requireActor, assertScope, AccessError } from "@/lib/platform-access";
import { writePlatformEvent } from "@/lib/platform-events";
import { publishTeamMessage } from "@/lib/platform-communication";
import { dispatchMailOutbox } from "@/lib/mail-outbox";
import { markBillingMilestonePaid } from "@/lib/billing/service";

const progressTaskInputSchema = z.object({
  phase: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(2000).nullable().transform((value) => value || null),
  period: z.string().trim().max(60).nullable().transform((value) => value || null),
  percentWeight: z.union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => /^\d{1,3}(?:\.\d{1,2})?$/.test(value) && Number(value) <= 100, "Enter a progress weight between 0 and 100 with at most two decimal places."),
  sequence: z.coerce.number().int().min(0).max(9999),
});

export async function createProgressTaskAction(villaCode: string, input: unknown) {
  const actor = await requireActor();
  if (actor.role === "buyer") throw new AccessError();
  const parsed = progressTaskInputSchema.parse(input);
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(villa).where(eq(villa.code, villaCode));
    if (!row) throw new AccessError();
    await assertScope(tx, actor, { projectId: row.projectId, villaId: row.id });
    const [created] = await tx.insert(progressTask).values({
      villaId: row.id, phase: parsed.phase, detail: parsed.detail, period: parsed.period,
      percentWeight: parsed.percentWeight, sequence: parsed.sequence,
    }).returning();
    await writePlatformEvent(tx, { actorId: actor.id, projectId: row.projectId, villaId: row.id, action: "progress.create", targetId: created.id, summary: `${row.code}: construction phase "${parsed.phase}" added.`, notify: false, pmSafe: true, link: `/koper/voortgang?villa=${row.id}` });
  });
  revalidatePath("/office", "layout"); revalidatePath("/koper", "layout");
}

export async function updateProgressTaskAction(taskId: string, villaCode: string, input: unknown) {
  z.uuid().parse(taskId);
  const actor = await requireActor();
  if (actor.role === "buyer") throw new AccessError();
  const parsed = progressTaskInputSchema.parse(input);
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(villa).where(eq(villa.code, villaCode));
    if (!row) throw new AccessError();
    await assertScope(tx, actor, { projectId: row.projectId, villaId: row.id });
    const [task] = await tx.select().from(progressTask).where(and(eq(progressTask.id, taskId), eq(progressTask.villaId, row.id))).for("update");
    if (!task) throw new AccessError();
    await tx.update(progressTask).set({
      phase: parsed.phase, detail: parsed.detail, period: parsed.period,
      percentWeight: parsed.percentWeight, sequence: parsed.sequence,
    }).where(eq(progressTask.id, taskId));
    await writePlatformEvent(tx, { actorId: actor.id, projectId: row.projectId, villaId: row.id, action: "progress.update", targetId: taskId, summary: `${row.code}: construction phase "${parsed.phase}" updated.`, notify: false, pmSafe: true, link: `/koper/voortgang?villa=${row.id}` });
  });
  revalidatePath("/office", "layout"); revalidatePath("/koper", "layout");
}

export async function deleteProgressTaskAction(taskId: string, villaCode: string) {
  z.uuid().parse(taskId);
  const actor = await requireActor();
  if (actor.role === "buyer") throw new AccessError();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(villa).where(eq(villa.code, villaCode));
    if (!row) throw new AccessError();
    await assertScope(tx, actor, { projectId: row.projectId, villaId: row.id });
    const [task] = await tx.select().from(progressTask).where(and(eq(progressTask.id, taskId), eq(progressTask.villaId, row.id))).for("update");
    if (!task) throw new AccessError();
    await tx.delete(progressTask).where(eq(progressTask.id, taskId));
    await writePlatformEvent(tx, { actorId: actor.id, projectId: row.projectId, villaId: row.id, action: "progress.delete", targetId: taskId, summary: `${row.code}: construction phase "${task.phase}" removed.`, notify: false, pmSafe: true, link: `/koper/voortgang?villa=${row.id}` });
  });
  revalidatePath("/office", "layout"); revalidatePath("/koper", "layout");
}

export async function toggleProgressTaskAction(taskId: string, villaCode: string, expectedDone?: boolean) {
  z.uuid().parse(taskId);
  const actor = await requireActor();
  if (actor.role === "buyer") throw new AccessError();
  // Callers must send the state they displayed. Blind legacy toggles cannot
  // safely distinguish a retry from a second intended change.
  if (typeof expectedDone !== "boolean") throw new AccessError("Refresh the progress screen before saving.", 409);
  await db.transaction(async tx => {
    const [row] = await tx.select().from(villa).where(eq(villa.code, villaCode));
    if (!row) throw new AccessError();
    await assertScope(tx, actor, { projectId: row.projectId, villaId: row.id });
    const [task] = await tx.select().from(progressTask).where(and(eq(progressTask.id, taskId), eq(progressTask.villaId, row.id))).for("update");
    if (!task) throw new AccessError();
    if (Boolean(task.doneAt) !== expectedDone) throw new AccessError("This task changed. Refresh before saving.", 409);
    const nowDone = !expectedDone;
    await tx.update(progressTask).set({ doneAt: nowDone ? new Date() : null, doneBy: nowDone ? actor.id : null }).where(eq(progressTask.id, taskId));
    await writePlatformEvent(tx, { actorId: actor.id, projectId: row.projectId, villaId: row.id, action: nowDone ? "progress.mark_done" : "progress.reopen", targetId: taskId, summary: `${row.code}: ${task.phase} ${nowDone ? "completed" : "reopened"}.`, notify: true, pmSafe: true, link: `/koper/voortgang?villa=${row.id}` });
  });
  after(() => dispatchMailOutbox());
  revalidatePath("/office", "layout"); revalidatePath("/koper", "layout");
}
export async function markPaymentPaidAction(milestoneId: string, villaCode: string) {
  return markBillingMilestonePaid(milestoneId, villaCode);
}
export async function createUpdateAction(formData: FormData) {
  const actor = await requireActor();
  if (actor.role === "buyer") throw new AccessError();
  const [row] = await db.select().from(villa).where(eq(villa.code, String(formData.get("villaCode") ?? "")));
  if (!row) throw new AccessError();
  await publishTeamMessage({ id: String(formData.get("requestId") || randomUUID()), projectId: row.projectId, villaId: row.id, title: String(formData.get("title") || "Site update"), body: String(formData.get("body") ?? ""), category: String(formData.get("category") || "Construction") });
  after(() => dispatchMailOutbox());
  revalidatePath("/office", "layout"); revalidatePath("/koper", "layout");
}
export async function addFileAction(_formData: FormData) {
  await requireActor(true);
  throw new AccessError("Use the private upload manager to add documents or photos.", 409);
}
