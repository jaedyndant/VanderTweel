import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({
  db: { query: { project: { findFirst: vi.fn() }, account: { findFirst: vi.fn() } } },
}));
vi.mock("@/lib/koper-data", () => ({
  getOwnedVillaChoicesForAccount: vi.fn(),
  getVillaOverview: vi.fn(),
  getVillaProgress: vi.fn(),
  getPaymentSchedule: vi.fn(),
}));

import { db } from "@/db/client";
import {
  getOwnedVillaChoicesForAccount,
  getPaymentSchedule,
  getVillaOverview,
  getVillaProgress,
} from "@/lib/koper-data";
import { getClientPlatformData } from "./client-platform-data";

const villa = {
  id: "villa-a",
  projectId: "project-a",
  code: "Villa 3",
  status: "building",
  typeLabel: "One-bedroom loft",
  builtM2: "80.46",
  plotM2: "94.00",
  outdoorM2: null,
  leaseYears: 30,
  pricePackage: "Premium",
  priceTotalUsd: "155000.00",
  buildStarted: new Date("2026-06-01T00:00:00.000Z"),
  handoverExpected: null,
  model3dUrl: "private-model-not-used-by-this-frontend",
  createdAt: new Date(),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getVillaOverview).mockResolvedValue({ villa, buyerName: "Emma" });
  vi.mocked(getOwnedVillaChoicesForAccount).mockResolvedValue([
    { id: villa.id, code: villa.code, projectName: "Cemagi Atelier" },
  ]);
  vi.mocked(getVillaProgress).mockResolvedValue({
    villa,
    tasks: [],
    updates: [],
  });
  vi.mocked(getPaymentSchedule).mockResolvedValue({
    villa,
    milestones: [],
    documents: [],
  });
  vi.mocked(db.query.project.findFirst).mockResolvedValue({
    id: "project-a",
    name: "Cemagi Atelier",
    slug: "cemagi",
    brandLocked: true,
    createdAt: new Date(),
  });
});

describe("client platform read model", () => {
  it("does not read project, progress or money when the existing villa gate denies access", async () => {
    vi.mocked(getVillaOverview).mockResolvedValue(null);
    await expect(
      getClientPlatformData("buyer-a", "villa-b", "home"),
    ).resolves.toBeNull();
    expect(getVillaOverview).toHaveBeenCalledWith("buyer-a", "villa-b");
    expect(db.query.project.findFirst).not.toHaveBeenCalled();
    expect(getVillaProgress).not.toHaveBeenCalled();
    expect(getPaymentSchedule).not.toHaveBeenCalled();
    expect(getOwnedVillaChoicesForAccount).not.toHaveBeenCalled();
  });

  it("locks subsequent scoped queries to the authorized villa, including an implicit selection", async () => {
    const result = await getClientPlatformData("buyer-a", undefined, "home");
    expect(getVillaProgress).toHaveBeenCalledWith("buyer-a", "villa-a");
    expect(getPaymentSchedule).toHaveBeenCalledWith("buyer-a", "villa-a");
    expect(result?.villa).toMatchObject({
      id: "villa-a",
      projectName: "Cemagi Atelier",
      builtM2: 80.46,
      priceTotalUsd: 155000,
      outdoorM2: null,
      buildStarted: "2026-06-01T00:00:00.000Z",
      handoverExpected: null,
    });
    expect(result?.villa).not.toHaveProperty("model3dUrl");
    expect(result?.villa).not.toHaveProperty("projectId");
    expect(result).toEqual(JSON.parse(JSON.stringify(result)));
  });

  it("fails closed if the buyer loses access during the parallel reads", async () => {
    vi.mocked(getPaymentSchedule).mockResolvedValue(null);
    await expect(
      getClientPlatformData("buyer-a", "villa-a", "home"),
    ).resolves.toBeNull();
  });

  it("exposes only minimal, account-scoped residence choices", async () => {
    const choices = [
      { id: villa.id, code: villa.code, projectName: "Cemagi Atelier" },
      { id: "villa-owned-2", code: "Villa 8", projectName: "Another owned project" },
    ];
    vi.mocked(getOwnedVillaChoicesForAccount).mockResolvedValue(choices);
    const result = await getClientPlatformData("buyer-a", villa.id, "home");
    expect(getOwnedVillaChoicesForAccount).toHaveBeenCalledWith("buyer-a");
    expect(result?.villaChoices).toEqual(choices);
    expect(result?.villaChoices.flatMap(Object.keys)).not.toContain("priceTotalUsd");
  });

  it("fails closed when the selected villa is no longer among the account's linked choices", async () => {
    vi.mocked(getOwnedVillaChoicesForAccount).mockResolvedValue([
      { id: "villa-owned-2", code: "Villa 8", projectName: "Cemagi Atelier" },
    ]);
    await expect(getClientPlatformData("buyer-a", villa.id, "home")).resolves.toBeNull();
  });

  it("keeps an explicit second residence selected on the account page", async () => {
    const second = { ...villa, id: "villa-owned-2", code: "Villa 8" };
    vi.mocked(getVillaOverview).mockResolvedValue({ villa: second, buyerName: "Emma" });
    vi.mocked(getPaymentSchedule).mockResolvedValue({ villa: second, milestones: [], documents: [] });
    vi.mocked(getOwnedVillaChoicesForAccount).mockResolvedValue([
      { id: villa.id, code: villa.code, projectName: "Cemagi Atelier" },
      { id: second.id, code: second.code, projectName: "Cemagi Atelier" },
    ]);
    vi.mocked(db.query.account.findFirst).mockResolvedValue({
      id: "buyer-a", email: "owner@example.com", notifyEmail: false,
      role: "buyer", lastLoginAt: null, createdAt: new Date(),
    });
    const result = await getClientPlatformData("buyer-a", second.id, "account");
    expect(getVillaOverview).toHaveBeenCalledWith("buyer-a", second.id);
    expect(getPaymentSchedule).toHaveBeenCalledWith("buyer-a", second.id);
    expect(result?.villa.id).toBe(second.id);
    expect(result?.account).toEqual({ email: "owner@example.com", notifyEmail: false });
  });

  it("never combines data returned for two different villas", async () => {
    vi.mocked(getVillaProgress).mockResolvedValue({
      villa: { ...villa, id: "villa-b" },
      tasks: [],
      updates: [],
    });
    await expect(
      getClientPlatformData("buyer-a", "villa-a", "home"),
    ).resolves.toBeNull();
  });

  it("does not fetch or serialize payment records on the progress screen", async () => {
    const result = await getClientPlatformData(
      "buyer-a",
      "villa-a",
      "progress",
    );
    expect(getPaymentSchedule).not.toHaveBeenCalled();
    expect(result?.milestones).toEqual([]);
    expect(result?.documents).toEqual([]);
  });

  it("serializes actual payment values and dates, retaining unknown amounts as null", async () => {
    vi.mocked(getPaymentSchedule).mockResolvedValue({
      villa,
      milestones: [
        {
          id: "payment-a",
          villaId: "villa-a",
          percent: "10.00",
          dueLabel: "Reservation",
          status: "paid",
          paidAt: new Date("2026-05-12T10:00:00.000Z"),
          sequence: 1,
          amountUsd: null,
          note: null,
          expectedAt: null,
        },
      ],
      documents: [
        {
          id: "file-a",
          villaId: "villa-a",
          uploadedBy: "internal-account-id",
          kind: "doc",
          url: "https://example.com/specification.pdf",
          label: "Specification",
          note: null,
          createdAt: new Date("2026-05-12T10:00:00.000Z"),
        },
      ],
    });
    const result = await getClientPlatformData(
      "buyer-a",
      "villa-a",
      "payments",
    );
    expect(result?.milestones[0]).toMatchObject({
      percent: 10,
      amountUsd: null,
      paidAt: "2026-05-12T10:00:00.000Z",
    });
    expect(result?.milestones[0]).not.toHaveProperty("villaId");
    expect(result?.documents[0]).not.toHaveProperty("uploadedBy");
    expect(getVillaProgress).not.toHaveBeenCalled();
  });

  it("does not send payment rows to the documents screen just because its existing wrapper also reads them", async () => {
    vi.mocked(getPaymentSchedule).mockResolvedValue({
      villa,
      milestones: [
        {
          id: "payment-a",
          villaId: "villa-a",
          percent: "10",
          dueLabel: "Reservation",
          status: "open",
          paidAt: null,
          sequence: 1,
          amountUsd: "15500",
          note: null,
          expectedAt: null,
        },
      ],
      documents: [],
    });
    const result = await getClientPlatformData(
      "buyer-a",
      "villa-a",
      "documents",
    );
    expect(result?.milestones).toEqual([]);
  });
});
