import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

// A merge may trigger Vercel production automatically. Never replace the
// working release with code whose additive migration has not been applied.
// This gate reads metadata only; it never runs migrations during a build.
if (process.env.VERCEL_ENV !== "production") {
  console.log("Production schema gate: not a production deployment.");
} else {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8_000,
    statement_timeout: 8_000,
    application_name: "vdt-release-schema-check",
    options: "-c default_transaction_read_only=on",
  });
  try {
    if (!process.env.DATABASE_URL) throw new Error("Database configuration missing");
    const sql = await readFile(new URL("../drizzle/0008_platform_functional_completion.sql", import.meta.url), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    await client.connect();
    const result = await client.query(`
      SELECT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1) AS migrated,
        EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'display_name') AS account_ready,
        to_regclass('public.managed_asset') IS NOT NULL
          AND to_regclass('public.billing_invoice') IS NOT NULL
          AND to_regclass('public.account_invitation') IS NOT NULL
          AND to_regclass('public.mail_outbox') IS NOT NULL AS features_ready
    `, [hash]);
    const row = result.rows[0];
    if (!row?.migrated || !row.account_ready || !row.features_ready) throw new Error("Required schema missing");
    console.log("Production schema gate: migration 0008 and required schema verified (read-only).");
  } catch {
    console.error("Production deployment blocked: migration 0008 could not be verified. Keep the existing release live. Apply the reviewed migration using the handoff runbook, verify DATABASE_URL, then redeploy. No database writes were performed by this gate.");
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}
