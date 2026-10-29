import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { buyerVilla, buyer, account, notification } from "@/db/schema";
import { sendEmail } from "./mailer";

// MS5: the team->koper coupling (TO chapter 4). Called at the end of every
// write action in office-actions.ts. The scope-check lives entirely in the
// buyerVilla query below -- a villa's write can only ever reach the buyers
// linked to THAT villa, never anyone else's (TO 11.3's recurring eval
// scenario: "can buyer A, via any route, reach villa B's data?" must be no).
// Same no-relations, plain-query pattern as office-data.ts/koper-data.ts.

export type NotificationSourceType = "payment" | "progress" | "update" | "file";

export type NotifyBuyersInput = {
  villaId: string;
  sourceType: NotificationSourceType;
  sourceId: string;
  summary: string;
};

export type NotifyBuyersResult = {
  notifiedBuyerIds: string[];
};

export async function notifyBuyersForVilla({
  villaId,
  sourceType,
  sourceId,
  summary,
}: NotifyBuyersInput): Promise<NotifyBuyersResult> {
  const links = await db.query.buyerVilla.findMany({ where: eq(buyerVilla.villaId, villaId) });
  if (links.length === 0) {
    return { notifiedBuyerIds: [] };
  }

  const buyerIds = links.map((l) => l.buyerId);
  const buyerRows = await db.query.buyer.findMany({ where: inArray(buyer.id, buyerIds) });
  const accountIds = buyerRows.map((b) => b.accountId);
  const accountRows = accountIds.length
    ? await db.query.account.findMany({ where: inArray(account.id, accountIds) })
    : [];

  const notifiedBuyerIds: string[] = [];

  for (const buyerRow of buyerRows) {
    notifiedBuyerIds.push(buyerRow.id);
    const email = accountRows.find((a) => a.id === buyerRow.accountId)?.email;

    // App channel: the koper-app always reads live data, so this row is
    // sent (visible) the instant it exists -- "next poll" per TO 7.4.
    await db.insert(notification).values({
      buyerId: buyerRow.id,
      sourceType,
      sourceId,
      channel: "app",
      sentAt: new Date(),
    });

    // Email channel: recorded first (audit trail per TO 10.2 exists even
    // if the send fails), stamped sentAt only on a confirmed send so a
    // failed Resend call is visible/retryable later, not silently lost.
    let sentAt: Date | null = null;
    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: "Update on your Cemagi Atelier villa",
          text: summary,
        });
        sentAt = new Date();
      } catch {
        sentAt = null;
      }
    }
    await db.insert(notification).values({
      buyerId: buyerRow.id,
      sourceType,
      sourceId,
      channel: "email",
      sentAt,
    });
  }

  return { notifiedBuyerIds };
}
