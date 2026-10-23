import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// DATABASE_URL komt uit de Vercel Neon-integratie (zie .env.example).
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
