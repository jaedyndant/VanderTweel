import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as core from "./schema";
import * as files from "./files-schema";
import * as billing from "./billing-schema";
import * as management from "./management-schema";
import * as events from "./events-schema";

// Business writes, audit and delivery queue commit together. HTTP cannot
// provide the interactive PostgreSQL transactions needed for this contract.
const globalDb = globalThis as unknown as { vdtPool?: Pool };
export const pool = globalDb.vdtPool ?? new Pool({
  connectionString: process.env.DATABASE_URL, max: 3,
  connectionTimeoutMillis: 10_000, idleTimeoutMillis: 20_000, allowExitOnIdle: true,
});
if (process.env.NODE_ENV !== "production") globalDb.vdtPool = pool;
export const db = drizzle(pool, { schema: { ...core, ...files, ...billing, ...management, ...events } });
export type PlatformTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
