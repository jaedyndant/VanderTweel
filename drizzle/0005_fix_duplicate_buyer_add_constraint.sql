-- Fixes a real duplicate-data bug found 2026-10-28: the buyer table has no
-- unique constraint, so 0003_ms2_account_backfill.sql's
-- "ON CONFLICT DO NOTHING" on the buyer insert was a no-op guard -- it
-- silently inserted a second "Emma Larsen" buyer row for an account that
-- already had one. The duplicate has zero buyer_villa links (confirmed
-- before writing this migration) so it is safe to remove.
--
-- This migration is itself idempotent: the DELETE only ever removes rows
-- that are (a) not the oldest buyer row for their account and (b) have no
-- buyer_villa link, so re-running it after the fix is a no-op. The new
-- unique constraint then makes it structurally impossible for this
-- specific bug to happen again.

DELETE FROM "buyer" b
WHERE NOT EXISTS (SELECT 1 FROM "buyer_villa" bv WHERE bv."buyer_id" = b."id")
AND b."created_at" > (
  SELECT MIN(b2."created_at") FROM "buyer" b2 WHERE b2."account_id" = b."account_id"
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'buyer_account_id_unique'
  ) THEN
    ALTER TABLE "buyer" ADD CONSTRAINT "buyer_account_id_unique" UNIQUE ("account_id");
  END IF;
END $$;
