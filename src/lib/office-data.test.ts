import { describe, it, expect, vi, beforeEach } from "vitest";

// MS4 klaar-criterium (PvA): "Ontwikkelaar ziet alle projecten; pm ziet
// alleen zijn eigen projecten, geen betalingen." Same structure as
// koper-data.test.ts: the pure authorization gate is tested standalone
// (no DB), then the DB-backed wrappers are tested to prove a pm's query
// never even issues the paymentMilestone/file queries — not fetched then
// hidden.

import { isAuthorizedForProject } from "./office-data";

const PROJECT_A = "aaaaaaaa-0000-0000-0000-000000000001";
const PROJECT_B = "bbbbbbbb-0000-0000-0000-000000000002";

describe("isAuthorizedForProject — pure authorization gate (no DB)", () => {
  it("a developer is authorized for every project, regardless of pmProjectIds", () => {
    expect(isAuthorizedForProject("developer", [], PROJECT_A)).toBe(true);
    expect(isAuthorizedForProject("developer", [PROJECT_B], PROJECT_A)).toBe(true);
  });

  it("a pm is authorized only for a project id in their own pmProjectIds", () => {
    expect(isAuthorizedForProject("pm", [PROJECT_A], PROJECT_A)).toBe(true);
  });

  it("a pm is NEVER authorized for a project id outside their own pmProjectIds", () => {
    expect(isAuthorizedForProject("pm", [PROJECT_A], PROJECT_B)).toBe(false);
  });

  it("a pm with no project links is authorized for nothing", () => {
    expect(isAuthorizedForProject("pm", [], PROJECT_A)).toBe(false);
  });

  it("fails closed for an unrecognized role", () => {
    // @ts-expect-error — exercising the fail-closed branch deliberately
    expect(isAuthorizedForProject("buyer", [PROJECT_A], PROJECT_A)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DB-backed wrappers, mocked at the db.query boundary (same pattern as
// koper-data.test.ts).
// ---------------------------------------------------------------------------

vi.mock("@/db/client", () => {
  return {
    db: {
      query: {
        project: { findFirst: vi.fn(), findMany: vi.fn() },
        villa: { findFirst: vi.fn(), findMany: vi.fn() },
        buyer: { findFirst: vi.fn(), findMany: vi.fn() },
        buyerVilla: { findFirst: vi.fn(), findMany: vi.fn() },
        projectManager: { findFirst: vi.fn() },
        pmProject: { findMany: vi.fn() },
        progressTask: { findMany: vi.fn() },
        paymentMilestone: { findMany: vi.fn() },
        update: { findMany: vi.fn() },
        file: { findMany: vi.fn() },
      },
    },
  };
});

import { db } from "@/db/client";
import { getAuthorizedOfficeVilla, getVillaForOffice, getBuyersDirectory } from "./office-data";

const ACCOUNT_PM = "11111111-1111-1111-1111-111111111111";
const ACCOUNT_DEV = "22222222-2222-2222-2222-222222222222";
const PM_ROW_ID = "33333333-3333-3333-3333-333333333333";
const VILLA_IN_A = "44444444-4444-4444-4444-444444444444";
const VILLA_IN_B = "55555555-5555-5555-5555-555555555555";

function mockPmManagingOnlyProjectA() {
  (db.query.projectManager.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: PM_ROW_ID,
    accountId: ACCOUNT_PM,
  });
  (db.query.pmProject.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
    { pmId: PM_ROW_ID, projectId: PROJECT_A },
  ]);
}

function mockVilla(id: string, projectId: string) {
  (db.query.villa.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
    id,
    projectId,
    code: "Villa X",
  });
}

describe("getAuthorizedOfficeVilla — pm scoping, end to end", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a pm managing project A is authorized for a villa inside project A", async () => {
    mockPmManagingOnlyProjectA();
    mockVilla(VILLA_IN_A, PROJECT_A);
    const result = await getAuthorizedOfficeVilla(ACCOUNT_PM, "pm", "Villa X");
    expect(result?.id).toBe(VILLA_IN_A);
  });

  it("a pm managing project A is NEVER authorized for a villa inside project B", async () => {
    mockPmManagingOnlyProjectA();
    mockVilla(VILLA_IN_B, PROJECT_B);
    const result = await getAuthorizedOfficeVilla(ACCOUNT_PM, "pm", "Villa X");
    expect(result).toBeNull();
  });

  it("a developer is authorized for any villa in any project", async () => {
    mockVilla(VILLA_IN_B, PROJECT_B);
    const result = await getAuthorizedOfficeVilla(ACCOUNT_DEV, "developer", "Villa X");
    expect(result?.id).toBe(VILLA_IN_B);
  });
});

describe("getVillaForOffice — money/files excluded for pm at the query layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.query.project.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: PROJECT_A, slug: "row-a" });
    (db.query.buyerVilla.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (db.query.progressTask.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.query.update.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("for a pm authorized on the villa: milestones and files are null, and those tables are never queried", async () => {
    mockPmManagingOnlyProjectA();
    mockVilla(VILLA_IN_A, PROJECT_A);
    const result = await getVillaForOffice(ACCOUNT_PM, "pm", "Villa X");
    expect(result?.milestones).toBeNull();
    expect(result?.files).toBeNull();
    expect(db.query.paymentMilestone.findMany).not.toHaveBeenCalled();
    expect(db.query.file.findMany).not.toHaveBeenCalled();
  });

  it("for a developer: milestones and files are fetched and returned", async () => {
    (db.query.paymentMilestone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "m1" }]);
    (db.query.file.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "f1" }]);
    mockVilla(VILLA_IN_B, PROJECT_B);
    const result = await getVillaForOffice(ACCOUNT_DEV, "developer", "Villa X");
    expect(result?.milestones).toEqual([{ id: "m1" }]);
    expect(result?.files).toEqual([{ id: "f1" }]);
  });

  it("returns null and never queries child tables for a pm on a villa outside their project", async () => {
    mockPmManagingOnlyProjectA();
    mockVilla(VILLA_IN_B, PROJECT_B);
    const result = await getVillaForOffice(ACCOUNT_PM, "pm", "Villa X");
    expect(result).toBeNull();
    expect(db.query.progressTask.findMany).not.toHaveBeenCalled();
    expect(db.query.paymentMilestone.findMany).not.toHaveBeenCalled();
    expect(db.query.file.findMany).not.toHaveBeenCalled();
  });
});

describe("getBuyersDirectory — developer-only screen", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for a pm — never an empty array that could be mistaken for 'no buyers'", async () => {
    const result = await getBuyersDirectory("pm");
    expect(result).toBeNull();
    expect(db.query.buyer.findMany).not.toHaveBeenCalled();
  });

  it("returns the buyer list for a developer", async () => {
    (db.query.buyer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "b1", name: "Emma Larsen" }]);
    (db.query.buyerVilla.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await getBuyersDirectory("developer");
    expect(result).toEqual([{ id: "b1", name: "Emma Larsen", villas: [] }]);
  });
});
