// ONE-OFF, throwaway QA fixture for a real-inbox delivery proof test.
// Creates a fully isolated project/villa/account/buyer/buyerVilla so
// notifyBuyersForVilla can only ever reach this one test buyer — never a
// real Cemagi Atelier buyer. Run against production DATABASE_URL, deleted
// with qa_cleanup_delivery_test.ts right after the proof is captured.

import { db } from "../src/db/client";
import { project, villa, account, buyer, buyerVilla } from "../src/db/schema";
import { eq } from "drizzle-orm";

const TEST_EMAIL = "jaedyntrinidad4@gmail.com";

async function main() {
  // Clean slate if a previous run left anything behind.
  const existingAccount = await db.query.account.findFirst({ where: eq(account.email, TEST_EMAIL) });
  if (existingAccount) {
    console.log("Existing QA account found, reusing:", existingAccount.id);
  }

  const [proj] = await db
    .insert(project)
    .values({ name: "QA Delivery Test (DELETE ME)", slug: `qa-delivery-test-${Date.now()}`, brandLocked: true })
    .returning();
  console.log("project:", proj.id, proj.slug);

  const [villaRow] = await db
    .insert(villa)
    .values({ projectId: proj.id, code: "QA-TEST-01", status: "on_schedule" })
    .returning();
  console.log("villa:", villaRow.id, villaRow.code);

  const acc =
    existingAccount ??
    (
      await db
        .insert(account)
        .values({ email: TEST_EMAIL, role: "buyer" })
        .returning()
    )[0];
  console.log("account:", acc.id, acc.email, acc.role);

  let buyerRow = await db.query.buyer.findFirst({ where: eq(buyer.accountId, acc.id) });
  if (!buyerRow) {
    [buyerRow] = await db
      .insert(buyer)
      .values({ accountId: acc.id, name: "QA Delivery Test Buyer" })
      .returning();
  }
  console.log("buyer:", buyerRow.id);

  await db.insert(buyerVilla).values({ buyerId: buyerRow.id, villaId: villaRow.id }).onConflictDoNothing();
  console.log("buyerVilla link created");

  console.log("\nQA_PROJECT_ID=" + proj.id);
  console.log("QA_VILLA_ID=" + villaRow.id);
  console.log("QA_VILLA_CODE=" + villaRow.code);
  console.log("QA_ACCOUNT_ID=" + acc.id);
  console.log("QA_BUYER_ID=" + buyerRow.id);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
