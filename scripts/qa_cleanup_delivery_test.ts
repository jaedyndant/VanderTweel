// Removes the isolated fixture created by qa_seed_delivery_test.ts, plus
// any notification/update/session rows it generated, so production ends up
// exactly as it was before the delivery-proof test.

import { db } from "../src/db/client";
import { project, villa, account, buyer, buyerVilla, notification, update, session } from "../src/db/schema";
import { eq, inArray, like } from "drizzle-orm";

const TEST_EMAIL = "jaedyntrinidad4@gmail.com";

async function main() {
  const acc = await db.query.account.findFirst({ where: eq(account.email, TEST_EMAIL) });
  const projects = await db.query.project.findMany({ where: like(project.slug, "qa-delivery-test-%") });
  const projectIds = projects.map((p) => p.id);

  if (projectIds.length) {
    const villas = await db.query.villa.findMany({ where: inArray(villa.projectId, projectIds) });
    const villaIds = villas.map((v) => v.id);

    if (villaIds.length) {
      await db.delete(update).where(inArray(update.villaId, villaIds));
    }

    if (acc) {
      const buyerRow = await db.query.buyer.findFirst({ where: eq(buyer.accountId, acc.id) });
      if (buyerRow) {
        await db.delete(notification).where(eq(notification.buyerId, buyerRow.id));
        if (villaIds.length) {
          await db.delete(buyerVilla).where(inArray(buyerVilla.villaId, villaIds));
        }
      }
    }

    if (villaIds.length) {
      await db.delete(villa).where(inArray(villa.id, villaIds));
    }
    await db.delete(project).where(inArray(project.id, projectIds));
    console.log("Deleted", projectIds.length, "QA project(s) and their villas/links.");
  } else {
    console.log("No QA test projects found.");
  }

  if (acc) {
    const buyerRow = await db.query.buyer.findFirst({ where: eq(buyer.accountId, acc.id) });
    if (buyerRow) {
      await db.delete(buyer).where(eq(buyer.id, buyerRow.id));
    }
    await db.delete(session).where(eq(session.accountId, acc.id));
    await db.delete(account).where(eq(account.id, acc.id));
    console.log("Deleted QA test account", acc.email);
  } else {
    console.log("No QA test account found.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
