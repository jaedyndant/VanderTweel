import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/office-data", () => ({
  getProjectsOverview: vi.fn(),
  getProjectDetail: vi.fn(),
  getVillaForOffice: vi.fn(),
  getBuyersDirectory: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { getBuyersDirectory, getProjectDetail, getProjectsOverview, getVillaForOffice } from "@/lib/office-data";
import { getOfficePlatformData } from "./office-platform-data";

const date = new Date("2026-10-30T13:00:00.000Z");
const project = { id: "project-a", name: "Cemagi Atelier", slug: "cemagi", brandLocked: true, createdAt: date };
const villa = {
  id: "villa-a", projectId: project.id, code: "Villa 1", status: "building",
  typeLabel: "One-bedroom loft", plotM2: "94.00", builtM2: "80.46", outdoorM2: null,
  buildStarted: date, handoverExpected: null, leaseYears: 30, pricePackage: "SECRET_PACKAGE",
  priceTotalUsd: "155000.00", model3dUrl: "SECRET_MODEL", createdAt: date,
};

function detail(): NonNullable<Awaited<ReturnType<typeof getVillaForOffice>>> {
  return {
    villa, project, buyerName: "Buyer A",
    tasks: [{ id: "task-a", villaId: villa.id, phase: "Foundation", percentWeight: "20.00",
      doneAt: date, doneBy: "SECRET_ACCOUNT", sequence: 1, detail: "Foundation works", period: "October" }],
    milestones: [{ id: "payment-a", villaId: villa.id, percent: "10.00", dueLabel: "Foundation",
      status: "paid", paidAt: date, sequence: 1, amountUsd: null, note: null, expectedAt: null }],
    updates: [
      { id: "update-money", villaId: villa.id, authorId: "developer-a", title: "Payment received",
        body: "SECRET_FINANCIAL_TEXT", category: "Payment", authorRoleLabel: "Developer", createdAt: date },
      { id: "update-mislabeled", villaId: villa.id, authorId: "developer-a", title: "Team update",
        body: "SECRET_MISLABELED_TEXT", category: "Construction", authorRoleLabel: "Developer", createdAt: date },
      { id: "update-own", villaId: villa.id, authorId: "pm-a", title: "Foundation complete",
        body: "My construction update", category: "Construction", authorRoleLabel: "Project manager", createdAt: date },
    ],
    files: [{ id: "file-a", villaId: villa.id, uploadedBy: "SECRET_ACCOUNT", kind: "doc",
      url: "https://files.example-cdn.com/document.pdf", label: "Contract", note: "SECRET_CONTRACT", createdAt: date }],
  };
}

function session(role = "developer") {
  vi.mocked(auth).mockResolvedValue({ user: { id: role === "pm" ? "pm-a" : "developer-a", role, email: "team@example.test" } } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  session();
  vi.mocked(getProjectsOverview).mockResolvedValue([{ ...project, villaCount: 1 }]);
  vi.mocked(getProjectDetail).mockResolvedValue({ project, villas: [{ ...villa, buyerName: "Buyer A" }] });
  vi.mocked(getVillaForOffice).mockResolvedValue(detail());
  vi.mocked(getBuyersDirectory).mockResolvedValue([{ id: "buyer-a", accountId: "SECRET_BUYER_ACCOUNT",
    name: "Buyer A", country: "Netherlands", createdAt: date, villas: [villa] }]);
});

describe("office presentation authorization and serialization", () => {
  it("rejects missing, buyer and unknown sessions before requesting data", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect(await getOfficePlatformData("overview")).toBeNull();
    session("buyer");
    expect(await getOfficePlatformData("overview")).toBeNull();
    session("unknown");
    expect(await getOfficePlatformData("overview")).toBeNull();
    expect(getProjectsOverview).not.toHaveBeenCalled();
  });

  it("rejects PM money/files/buyer routes before any data fetch", async () => {
    session("pm");
    for (const page of ["payments", "documents", "buyers"] as const) {
      expect(await getOfficePlatformData(page)).toBeNull();
    }
    expect(getProjectsOverview).not.toHaveBeenCalled();
    expect(getBuyersDirectory).not.toHaveBeenCalled();
  });

  it("does not serialize PM money, files, session internals or other authors' free text", async () => {
    session("pm");
    // Deliberately supply sensitive fields even though existing wrappers omit
    // money/file child arrays for PM: the RSC allowlist is independently tested.
    const output = await getOfficePlatformData("overview");
    expect(output?.villas[0]).not.toHaveProperty("priceTotalUsd");
    expect(output?.villas[0]).not.toHaveProperty("pricePackage");
    expect(output?.villas[0]).not.toHaveProperty("model3dUrl");
    expect(output?.payments).toBeNull();
    expect(output?.files).toBeNull();
    expect(output?.buyers).toBeNull();
    expect(output?.updates.map((entry) => entry.id)).toEqual(["update-own"]);
    expect(JSON.stringify(output)).not.toContain("SECRET");
    expect(output?.tasks[0]).not.toHaveProperty("doneBy");
    expect(output?.updates[0]).not.toHaveProperty("authorId");
    expect(output).not.toHaveProperty("accountId");
    expect(output).toEqual(JSON.parse(JSON.stringify(output)));
  });

  it("retains unknown amounts/dates and uses actual weighted progress", async () => {
    const output = await getOfficePlatformData("overview");
    expect(output?.villas[0]).toMatchObject({ priceTotalUsd: 155000, builtM2: 80.46,
      outdoorM2: null, handoverExpected: null, progressPercent: 20 });
    expect(output?.payments?.[0]).toMatchObject({ amountUsd: null, percent: 10, paidAt: date.toISOString() });
    const empty = detail();
    empty.tasks = [];
    vi.mocked(getVillaForOffice).mockResolvedValue(empty);
    expect((await getOfficePlatformData("villas"))?.villas[0].progressPercent).toBeNull();
  });

  it("fails closed for unavailable projects and conflicting explicit selectors", async () => {
    expect(await getOfficePlatformData("villas", { projectId: "other-project" })).toBeNull();
    expect(await getOfficePlatformData("villas", { projectId: "" })).toBeNull();
    expect(await getOfficePlatformData("project", { projectId: project.id, projectSlug: "other" })).toBeNull();
    expect(getProjectDetail).not.toHaveBeenCalled();
    expect(getVillaForOffice).not.toHaveBeenCalled();
  });

  it("fails closed if an authorized project read is revoked or mismatched", async () => {
    vi.mocked(getProjectDetail).mockResolvedValue(null);
    expect(await getOfficePlatformData("overview")).toBeNull();
    vi.mocked(getProjectDetail).mockResolvedValue({ project: { ...project, id: "other" }, villas: [] });
    expect(await getOfficePlatformData("overview")).toBeNull();
    expect(getVillaForOffice).not.toHaveBeenCalled();
  });

  it("rejects ambiguous villa codes before fetching a code-based detail", async () => {
    vi.mocked(getProjectDetail).mockResolvedValue({ project, villas: [
      { ...villa, buyerName: "Buyer A" }, { ...villa, id: "villa-b", buyerName: "Buyer B" },
    ] });
    expect(await getOfficePlatformData("villa", { villaCode: villa.code })).toBeNull();
    expect(getVillaForOffice).not.toHaveBeenCalled();
  });

  it("rejects cross-villa, cross-project, and child-record mismatches", async () => {
    const wrongVilla = detail();
    wrongVilla.villa = { ...villa, id: "villa-b" };
    vi.mocked(getVillaForOffice).mockResolvedValue(wrongVilla);
    expect(await getOfficePlatformData("overview")).toBeNull();
    const wrongProject = detail();
    wrongProject.project = { ...project, id: "project-b" };
    vi.mocked(getVillaForOffice).mockResolvedValue(wrongProject);
    expect(await getOfficePlatformData("overview")).toBeNull();
    const wrongChild = detail();
    wrongChild.tasks[0].villaId = "villa-b";
    vi.mocked(getVillaForOffice).mockResolvedValue(wrongChild);
    expect(await getOfficePlatformData("overview")).toBeNull();
  });

  it("keeps authorized project navigation while narrowing the page to the selected project", async () => {
    const second = { ...project, id: "project-b", slug: "second", name: "Second" };
    vi.mocked(getProjectsOverview).mockResolvedValue([{ ...project, villaCount: 1 }, { ...second, villaCount: 2 }]);
    const output = await getOfficePlatformData("project", { projectId: project.id });
    expect(output?.projects).toHaveLength(2);
    expect(getProjectDetail).toHaveBeenCalledTimes(1);
    expect(getProjectDetail).toHaveBeenCalledWith("developer-a", "developer", project.slug);
    expect(output?.selection.projectId).toBe(project.id);
    expect(output?.updates).toHaveLength(3);
  });

  it("does not send unrelated arrays to documents or expose unsafe legacy file links", async () => {
    const data = detail();
    data.files![0].url = "javascript:alert(1)";
    vi.mocked(getVillaForOffice).mockResolvedValue(data);
    const output = await getOfficePlatformData("documents");
    expect(output?.files?.[0].url).toBeNull();
    expect(output?.files?.[0]).not.toHaveProperty("uploadedBy");
    expect(output?.payments).toEqual([]);
    expect(output?.tasks).toEqual([]);
    expect(output?.updates).toEqual([]);
  });

  it("limits the buyer directory to presentation fields and confirmed villa associations", async () => {
    const output = await getOfficePlatformData("buyers");
    expect(output?.buyers).toEqual([{ id: "buyer-a", name: "Buyer A", country: "Netherlands",
      villas: [{ id: villa.id, code: villa.code, projectId: project.id }] }]);
    expect(JSON.stringify(output)).not.toContain("SECRET_BUYER_ACCOUNT");
  });

  it("returns honest empty state and requires explicit selection on detail-only pages", async () => {
    vi.mocked(getProjectsOverview).mockResolvedValue([]);
    const output = await getOfficePlatformData("overview");
    expect(output?.projects).toEqual([]);
    expect(output?.villas).toEqual([]);
    expect(output?.payments).toEqual([]);
    expect(await getOfficePlatformData("project")).toBeNull();
    expect(await getOfficePlatformData("villa")).toBeNull();
    expect(await getOfficePlatformData("progress")).toBeNull();
  });
});
