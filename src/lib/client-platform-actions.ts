"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/db/client";
import { account } from "@/db/schema";

const notifyEmailSchema = z.object({
  notifyEmail: z.boolean(),
});

export type AccountActionResult = { ok: true } | { ok: false; error: string };

/**
 * Buyers may update their own notification preference only -- own account
 * row, resolved from the session, never a caller-supplied id. This is the
 * one write the buyer surface is allowed to make (everything else --
 * payment, construction, document, update records -- stays team-authored,
 * see client-platform-data.ts).
 */
export async function updateNotificationPreference(
  input: unknown
): Promise<AccountActionResult> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "buyer") {
    return { ok: false, error: "Your session has expired. Sign in and try again." };
  }

  const parsed = notifyEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That preference value is invalid." };
  }

  try {
    await db
      .update(account)
      .set({ notifyEmail: parsed.data.notifyEmail })
      .where(eq(account.id, user.id));
    revalidatePath("/koper/account");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save your preference. Try again." };
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect("/login");
}
