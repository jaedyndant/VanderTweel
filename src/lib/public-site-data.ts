import "server-only";

import { cache } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { villa } from "@/db/schema";

export type PublicVilla = {
  id: string;
  code: string;
  slug: string;
  typeLabel: string | null;
  plotM2: number | null;
  builtM2: number | null;
  outdoorM2: number | null;
  leaseYears: number | null;
  pricePackage: string | null;
  priceTotalUsd: number | null;
  status: string;
  handoverExpected: string | null;
};

function numeric(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugify(code: string): string {
  return code.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Public marketing-site read: no account/session scoping (this is the
 * brochure-facing villa collection, not buyer-private data — plot size,
 * type, lease term and list price are the same numbers already shown on
 * the signed-off concept demo's public pages). Never pull buyer, payment,
 * progress-task or document rows here — those stay behind (koper) auth.
 */
export const getPublicVillas = cache(async (): Promise<PublicVilla[]> => {
  const rows = await db.query.villa.findMany({ orderBy: asc(villa.code) });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    slug: slugify(row.code),
    typeLabel: row.typeLabel,
    plotM2: numeric(row.plotM2),
    builtM2: numeric(row.builtM2),
    outdoorM2: numeric(row.outdoorM2),
    leaseYears: row.leaseYears,
    pricePackage: row.pricePackage,
    priceTotalUsd: numeric(row.priceTotalUsd),
    status: row.status,
    handoverExpected: row.handoverExpected ? row.handoverExpected.toISOString() : null,
  }));
});

export const getPublicVillaBySlug = cache(
  async (slug: string): Promise<PublicVilla | null> => {
    const villas = await getPublicVillas();
    return villas.find((v) => v.slug === slug) ?? null;
  },
);
