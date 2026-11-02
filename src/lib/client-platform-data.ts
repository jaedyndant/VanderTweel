import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { project } from "@/db/schema";
import {
  getPaymentSchedule,
  getVillaOverview,
  getVillaProgress,
} from "@/lib/koper-data";
import type {
  ClientPage,
  ClientPlatformData,
} from "@/components/client-platform/types";

function numeric(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new Error("Invalid numeric value in buyer data");
  return parsed;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

/**
 * A presentation-only adapter around the existing, buyer-scoped backend.
 * React.cache deduplicates within a server render, never between requests or
 * buyers. No `use cache`, static cache or browser database client belongs here.
 */
export const getClientPlatformData = cache(
  async (
    accountId: string,
    requestedVillaId: string | undefined,
    page: ClientPage,
  ): Promise<ClientPlatformData | null> => {
    const overview = await getVillaOverview(accountId, requestedVillaId);
    if (!overview) return null;

    // Resolve first, then pin every read to that exact authorized villa. An
    // omitted ?villa must never select different villas across parallel reads.
    const { villa } = overview;
    const needsProgress =
      page === "home" || page === "progress" || page === "updates";
    const needsFilesAndPayments = page !== "progress";
    const [progress, payments, projectRow] = await Promise.all([
      needsProgress ? getVillaProgress(accountId, villa.id) : null,
      needsFilesAndPayments ? getPaymentSchedule(accountId, villa.id) : null,
      db.query.project.findFirst({
        where: eq(project.id, villa.projectId),
        columns: { name: true },
      }),
    ]);

    // A link may have been removed while the page was loading. Do not turn a
    // rejected scoped read into an apparently successful, partially empty page.
    if (needsProgress && progress?.villa.id !== villa.id) return null;
    if (needsFilesAndPayments && payments?.villa.id !== villa.id) return null;

    return {
      buyerName: overview.buyerName,
      villa: {
        id: villa.id,
        code: villa.code,
        projectName: projectRow?.name ?? "Your project",
        status: villa.status,
        typeLabel: villa.typeLabel,
        builtM2: numeric(villa.builtM2),
        plotM2: numeric(villa.plotM2),
        outdoorM2: numeric(villa.outdoorM2),
        leaseYears: villa.leaseYears,
        pricePackage: villa.pricePackage,
        priceTotalUsd: numeric(villa.priceTotalUsd),
        buildStarted: iso(villa.buildStarted),
        handoverExpected: iso(villa.handoverExpected),
      },
      tasks: (page === "home" || page === "progress"
        ? (progress?.tasks ?? [])
        : []
      ).map((task) => ({
        id: task.id,
        phase: task.phase,
        percentWeight: numeric(task.percentWeight)!,
        doneAt: iso(task.doneAt),
        sequence: task.sequence,
        detail: task.detail,
        period: task.period,
      })),
      milestones: (page === "home" || page === "payments"
        ? (payments?.milestones ?? [])
        : []
      ).map((milestone) => ({
        id: milestone.id,
        percent: numeric(milestone.percent)!,
        dueLabel: milestone.dueLabel,
        status: milestone.status,
        paidAt: iso(milestone.paidAt),
        sequence: milestone.sequence,
        amountUsd: numeric(milestone.amountUsd),
        note: milestone.note,
        expectedAt: iso(milestone.expectedAt),
      })),
      documents: (payments?.documents ?? []).map((document) => ({
        id: document.id,
        kind: document.kind,
        url: document.url,
        label: document.label,
        note: document.note,
        createdAt: document.createdAt.toISOString(),
      })),
      updates: (page === "home" || page === "updates"
        ? (progress?.updates ?? [])
        : []
      ).map((entry) => ({
        id: entry.id,
        title: entry.title,
        body: entry.body,
        category: entry.category,
        authorRoleLabel: entry.authorRoleLabel,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  },
);
