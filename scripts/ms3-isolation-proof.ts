// Integration-level proof of the MS3 klaar-criterium, run against the real
// STAGING Neon DB (not mocked): buyer@cemagiatelier.test's queries must
// return ONLY villa_A ids/fields, buyer2@cemagiatelier.test's queries must
// return ONLY villa_B ids/fields — and cross-requesting the other buyer's
// villa id must resolve to null everywhere, never leak data.
//
// This is a throwaway verification script (not part of the app/test suite),
// run manually against DATABASE_URL=$STAGING_DATABASE_URL and deleted after
// use — see the MS3 PR description for the exact commands and output.

import { getAuthorizedVilla, getVillaOverview, getVillaProgress, getPaymentSchedule } from "../src/lib/koper-data";
import { db } from "../src/db/client";
import { account } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const buyerA = await db.query.account.findFirst({ where: eq(account.email, "buyer@cemagiatelier.test") });
  const buyerB = await db.query.account.findFirst({ where: eq(account.email, "buyer2@cemagiatelier.test") });
  if (!buyerA || !buyerB) throw new Error("seed accounts missing");

  console.log("=== buyer@cemagiatelier.test (Emma Larsen) ===");
  const ownA = await getAuthorizedVilla(buyerA.id);
  console.log("own villa:", ownA?.code, ownA?.id);
  const overviewA = await getVillaOverview(buyerA.id);
  console.log("overview buyerName:", overviewA?.buyerName, "villa:", overviewA?.villa.code);
  const progressA = await getVillaProgress(buyerA.id);
  console.log("progress task count:", progressA?.tasks.length, "update count:", progressA?.updates.length);
  const paymentA = await getPaymentSchedule(buyerA.id);
  console.log(
    "payment milestone count:",
    paymentA?.milestones.length,
    "doc count:",
    paymentA?.documents.length
  );

  console.log("\n=== buyer2@cemagiatelier.test (Marcus Oduya) ===");
  const ownB = await getAuthorizedVilla(buyerB.id);
  console.log("own villa:", ownB?.code, ownB?.id);
  const overviewB = await getVillaOverview(buyerB.id);
  console.log("overview buyerName:", overviewB?.buyerName, "villa:", overviewB?.villa.code);

  console.log("\n=== CROSS-BUYER ISOLATION CHECK ===");
  if (!ownA || !ownB) throw new Error("expected both buyers to own a villa");

  const buyerARequestsVillaB = await getAuthorizedVilla(buyerA.id, ownB.id);
  console.log("buyer A requesting villa B's id ->", buyerARequestsVillaB);

  const buyerBRequestsVillaA = await getAuthorizedVilla(buyerB.id, ownA.id);
  console.log("buyer B requesting villa A's id ->", buyerBRequestsVillaA);

  const overviewCross = await getVillaOverview(buyerA.id, ownB.id);
  console.log("buyer A overview for villa B's id ->", overviewCross);

  const progressCross = await getVillaProgress(buyerB.id, ownA.id);
  console.log("buyer B progress for villa A's id ->", progressCross);

  const paymentCross = await getPaymentSchedule(buyerB.id, ownA.id);
  console.log("buyer B payment schedule for villa A's id ->", paymentCross);

  const pass =
    ownA.id !== ownB.id &&
    buyerARequestsVillaB === null &&
    buyerBRequestsVillaA === null &&
    overviewCross === null &&
    progressCross === null &&
    paymentCross === null;

  console.log("\nRESULT:", pass ? "PASS — buyer A and buyer B are fully isolated" : "FAIL — isolation broken");
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
