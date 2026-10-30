import "server-only";

import { cache } from "react";
import { auth } from "@/lib/auth";
import { safeDocumentUrl } from "@/components/client-platform/presentation";
import {
  getBuyersDirectory,
  getProjectDetail,
  getProjectsOverview,
  getVillaForOffice,
} from "@/lib/office-data";
import type {
  OfficePage,
  OfficePlatformData,
  OfficeRecordScope,
  OfficeRole,
  OfficeVilla,
} from "@/components/office-platform/types";

type VillaDetail = NonNullable<Awaited<ReturnType<typeof getVillaForOffice>>>;

function numeric(value: string | number | null): number | null {
  if (value === null || value === "") return null;
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error("Invalid number in office data");
  return result;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function scope(detail: VillaDetail): OfficeRecordScope {
  return {
    villaId: detail.villa.id,
    villaCode: detail.villa.code,
    projectId: detail.villa.projectId,
  };
}

function presentVilla(detail: VillaDetail, role: OfficeRole): OfficeVilla {
  const { villa, project, tasks } = detail;
  const progressPercent = tasks.length
    ? Math.min(100, Math.max(0, tasks.reduce((sum, task) => sum + (task.doneAt ? numeric(task.percentWeight)! : 0), 0)))
    : null;
  const allowed: OfficeVilla = {
    id: villa.id,
    code: villa.code,
    projectId: villa.projectId,
    projectName: project!.name,
    projectSlug: project!.slug,
    buyerName: detail.buyerName,
    status: villa.status,
    typeLabel: villa.typeLabel,
    plotM2: numeric(villa.plotM2),
    builtM2: numeric(villa.builtM2),
    outdoorM2: numeric(villa.outdoorM2),
    buildStarted: iso(villa.buildStarted),
    handoverExpected: iso(villa.handoverExpected),
    progressPercent,
  };
  if (role === "developer") {
    allowed.pricePackage = villa.pricePackage;
    allowed.priceTotalUsd = numeric(villa.priceTotalUsd);
  }
  return allowed;
}

/**
 * Request-only caching, keyed by primitive selection values. Existing office
 * wrappers remain the only database access/authorization boundary. Raw rows
 * never cross the RSC boundary, especially a PM's villa prices or shared feed.
 */
const readOfficePlatformData = cache(async (
  page: OfficePage,
  projectSlug: string | undefined,
  villaCode: string | undefined,
  projectId: string | undefined,
): Promise<OfficePlatformData | null> => {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; email?: string | null } | undefined;
  if (!user?.id || (user.role !== "pm" && user.role !== "developer")) return null;
  const role = user.role;
  if (role === "pm" && ["buyers", "payments", "documents"].includes(page)) return null;

  const projects = await getProjectsOverview(user.id, role);
  if (new Set(projects.map((project) => project.id)).size !== projects.length ||
      new Set(projects.map((project) => project.slug)).size !== projects.length) return null;

  const selectedProject = projects.find((project) =>
    (projectSlug === undefined || project.slug === projectSlug) &&
    (projectId === undefined || project.id === projectId));
  if ((projectSlug !== undefined || projectId !== undefined) && !selectedProject) return null;
  if (page === "project" && projectSlug === undefined && projectId === undefined) return null;
  if ((page === "villa" || page === "progress") && villaCode === undefined) return null;

  // Include all permitted projects in navigation, but read only the explicitly
  // selected project's villas when one is requested.
  const scopedProjects = projectSlug !== undefined || projectId !== undefined
    ? [selectedProject!]
    : projects;
  const projectDetails = await Promise.all(scopedProjects.map((project) =>
    getProjectDetail(user.id!, role, project.slug)));
  for (let index = 0; index < projectDetails.length; index += 1) {
    const detail = projectDetails[index];
    const expected = scopedProjects[index];
    if (!detail || detail.project.id !== expected.id || detail.project.slug !== expected.slug ||
        detail.villas.some((villa) => villa.projectId !== expected.id)) return null;
  }

  const availableVillas = projectDetails.flatMap((detail) => detail!.villas);
  // Existing routes/actions resolve by code. Refuse ambiguous codes instead of
  // silently displaying or mutating a different villa with the same label.
  if (new Set(availableVillas.map((villa) => villa.id)).size !== availableVillas.length ||
      new Set(availableVillas.map((villa) => villa.code)).size !== availableVillas.length) return null;
  const selectedVilla = villaCode === undefined
    ? null
    : availableVillas.find((villa) => villa.code === villaCode);
  if (villaCode !== undefined && !selectedVilla) return null;
  const villasToRead = selectedVilla ? [selectedVilla] : availableVillas;
  const details = await Promise.all(villasToRead.map((villa) =>
    getVillaForOffice(user.id!, role, villa.code)));
  for (let index = 0; index < details.length; index += 1) {
    const detail = details[index];
    const expected = villasToRead[index];
    if (!detail || detail.villa.id !== expected.id || detail.villa.code !== expected.code ||
        detail.villa.projectId !== expected.projectId || detail.project?.id !== expected.projectId ||
        detail.tasks.some((task) => task.villaId !== expected.id) ||
        detail.updates.some((entry) => entry.villaId !== expected.id) ||
        detail.milestones?.some((entry) => entry.villaId !== expected.id) ||
        detail.files?.some((entry) => entry.villaId !== expected.id)) return null;
  }
  const authorized = details as VillaDetail[];
  const needsTasks = ["overview", "villas", "project", "villa", "progress"].includes(page);
  const needsPayments = ["overview", "villas", "project", "villa", "payments"].includes(page);
  const needsUpdates = ["overview", "project", "villa", "updates"].includes(page);
  const needsFiles = ["villa", "documents"].includes(page);

  let buyers: OfficePlatformData["buyers"] = role === "developer" ? [] : null;
  if (role === "developer" && page === "buyers") {
    const directory = await getBuyersDirectory(role);
    if (!directory) return null;
    const allowedVillas = new Map(availableVillas.map((villa) => [villa.id, villa]));
    buyers = directory.map((buyer) => ({
      id: buyer.id,
      name: buyer.name,
      country: buyer.country,
      villas: buyer.villas.filter((villa) => {
        const allowed = allowedVillas.get(villa.id);
        return allowed && allowed.code === villa.code && allowed.projectId === villa.projectId;
      }).map((villa) => ({ id: villa.id, code: villa.code, projectId: villa.projectId })),
    }));
    if (projectSlug !== undefined || projectId !== undefined || villaCode !== undefined) {
      const selectedIds = new Set(villasToRead.map((villa) => villa.id));
      buyers = buyers.map((buyer) => ({
        ...buyer,
        villas: buyer.villas.filter((villa) => selectedIds.has(villa.id)),
      })).filter((buyer) => buyer.villas.length > 0);
    }
  }

  return {
    page,
    role,
    email: user.email ?? null,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      villaCount: project.villaCount,
    })),
    villas: authorized.map((detail) => presentVilla(detail, role)),
    buyers,
    tasks: needsTasks ? authorized.flatMap((detail) => detail.tasks.map((task) => ({
      ...scope(detail),
      id: task.id,
      phase: task.phase,
      percentWeight: numeric(task.percentWeight)!,
      doneAt: iso(task.doneAt),
      sequence: task.sequence,
      detail: task.detail,
      period: task.period,
    }))) : [],
    payments: role === "developer" ? (needsPayments ? authorized.flatMap((detail) =>
      (detail.milestones ?? []).map((payment) => ({
        ...scope(detail),
        id: payment.id,
        percent: numeric(payment.percent)!,
        dueLabel: payment.dueLabel,
        status: payment.status,
        paidAt: iso(payment.paidAt),
        sequence: payment.sequence,
        amountUsd: numeric(payment.amountUsd),
        note: payment.note,
        expectedAt: iso(payment.expectedAt),
      }))) : []) : null,
    updates: needsUpdates ? authorized.flatMap((detail) => detail.updates
      // No category-only filter: the existing feed has no trusted content
      // classification. PMs receive only construction text they authored.
      .filter((entry) => role === "developer" ||
        (entry.authorId === user.id && entry.category === "Construction"))
      .map((entry) => ({
        ...scope(detail),
        id: entry.id,
        title: entry.title,
        body: entry.body,
        category: entry.category,
        authorRoleLabel: entry.authorRoleLabel,
        createdAt: entry.createdAt.toISOString(),
      }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [],
    files: role === "developer" ? (needsFiles ? authorized.flatMap((detail) =>
      (detail.files ?? []).map((file) => ({
        ...scope(detail),
        id: file.id,
        kind: file.kind,
        url: safeDocumentUrl(file.url),
        label: file.label,
        note: file.note,
        createdAt: file.createdAt.toISOString(),
      }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []) : null,
    selection: {
      projectId: selectedVilla?.projectId ??
        ((projectSlug !== undefined || projectId !== undefined) ? selectedProject!.id : null),
      villaId: selectedVilla?.id ?? null,
      villaCode: selectedVilla?.code ?? null,
    },
  };
});

export async function getOfficePlatformData(
  page: OfficePage,
  options: { projectSlug?: string; villaCode?: string; projectId?: string } = {},
): Promise<OfficePlatformData | null> {
  return readOfficePlatformData(page, options.projectSlug, options.villaCode, options.projectId);
}
