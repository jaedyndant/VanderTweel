"use server";

// Back-office write actions (MS4). TO chapter 4: every write here is the
// "teamactie" half of the team->koper dataflow — a write to progress_task/
// payment_milestone/update/file is what the koper-app screens (MS3) read on
// their next request. Every action re-derives role from the server-side
// session (never trusts a client-supplied role) and re-checks villa
// authorization via getAuthorizedOfficeVilla before writing anything.

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { progressTask, paymentMilestone, update, file } from "@/db/schema";
import { getAuthorizedOfficeVilla, type OfficeRole } from "@/lib/office-data";

async function requireOfficeSession(): Promise<{ accountId: string; role: OfficeRole }> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== "pm" && user.role !== "developer")) {
    throw new Error("Not authorized for the back-office");
  }
  return { accountId: user.id, role: user.role };
}

/** Toggle a progress task done/not-done. Both pm and developer may do this
 * for their own authorized villas (TO 1.3: voortgang is not money/contract
 * data, so it's not restricted to developer only). */
export async function toggleProgressTaskAction(taskId: string, villaCode: string) {
  const { accountId, role } = await requireOfficeSession();
  const villaRow = await getAuthorizedOfficeVilla(accountId, role, villaCode);
  if (!villaRow) throw new Error("Not authorized for this villa");

  const task = await db.query.progressTask.findFirst({ where: eq(progressTask.id, taskId) });
  if (!task || task.villaId !== villaRow.id) throw new Error("Task does not belong to this villa");

  await db
    .update(progressTask)
    .set({ doneAt: task.doneAt ? null : new Date(), doneBy: task.doneAt ? null : accountId })
    .where(eq(progressTask.id, taskId));

  revalidatePath(`/office/villas/${villaCode}/voortgang`);
  revalidatePath(`/office/villas/${villaCode}`);
  revalidatePath("/koper/voortgang");
}

/** Toggle a payment milestone paid/open. Developer-only (TO 1.3: pm screens
 * exclude money entirely) — re-checked here, not just hidden upstream. */
export async function markPaymentPaidAction(milestoneId: string, villaCode: string) {
  const { accountId, role } = await requireOfficeSession();
  if (role !== "developer") throw new Error("Only the developer role manages payments");

  const villaRow = await getAuthorizedOfficeVilla(accountId, role, villaCode);
  if (!villaRow) throw new Error("Not authorized for this villa");

  const milestone = await db.query.paymentMilestone.findFirst({
    where: eq(paymentMilestone.id, milestoneId),
  });
  if (!milestone || milestone.villaId !== villaRow.id) {
    throw new Error("Milestone does not belong to this villa");
  }

  const nowPaid = milestone.status !== "paid";
  await db
    .update(paymentMilestone)
    .set({ status: nowPaid ? "paid" : "open", paidAt: nowPaid ? new Date() : null })
    .where(eq(paymentMilestone.id, milestoneId));

  revalidatePath(`/office/villas/${villaCode}/betalingen`);
  revalidatePath(`/office/villas/${villaCode}`);
  revalidatePath("/koper/betaalschema");
}

/** Post a new team update. Both pm and developer may post for their own
 * authorized villas — this is the exact write that becomes visible to the
 * buyer on their next /koper/voortgang load. */
export async function createUpdateAction(formData: FormData) {
  const { accountId, role } = await requireOfficeSession();
  const villaCode = String(formData.get("villaCode") ?? "");
  const villaRow = await getAuthorizedOfficeVilla(accountId, role, villaCode);
  if (!villaRow) throw new Error("Not authorized for this villa");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Update text is required");
  const title = String(formData.get("title") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  const roleLabel = role === "developer" ? "Developer" : "Project manager";

  await db.insert(update).values({
    villaId: villaRow.id,
    authorId: accountId,
    title,
    body,
    category,
    authorRoleLabel: roleLabel,
  });

  revalidatePath(`/office/villas/${villaCode}/updates`);
  revalidatePath("/koper/voortgang");
}

/** Attach a file record (url only, per TO 6: bytes never go in the db).
 * Developer-only (TO 1.3: pm screens exclude contract files entirely). */
export async function addFileAction(formData: FormData) {
  const { accountId, role } = await requireOfficeSession();
  if (role !== "developer") throw new Error("Only the developer role manages files");

  const villaCode = String(formData.get("villaCode") ?? "");
  const villaRow = await getAuthorizedOfficeVilla(accountId, role, villaCode);
  if (!villaRow) throw new Error("Not authorized for this villa");

  const url = String(formData.get("url") ?? "").trim();
  if (!url) throw new Error("File URL is required");
  const label = String(formData.get("label") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const kind = String(formData.get("kind") ?? "doc").trim() || "doc";

  await db.insert(file).values({ villaId: villaRow.id, uploadedBy: accountId, kind, url, label, note });

  revalidatePath(`/office/villas/${villaCode}/bestanden`);
  revalidatePath("/koper/betaalschema");
}
