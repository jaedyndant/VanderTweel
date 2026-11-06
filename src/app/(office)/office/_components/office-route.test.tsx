import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));
vi.mock("@/lib/platform-access", () => ({
  requireActor: vi.fn(),
  AccessError: class AccessError extends Error {},
}));
vi.mock("@/lib/office-platform-data", () => ({ getOfficePlatformData: vi.fn() }));
vi.mock("@/lib/office-platform-actions", () => ({
  addFileLink: vi.fn(), deleteProgressTask: vi.fn(), publishUpdate: vi.fn(),
  saveProgressTask: vi.fn(), togglePayment: vi.fn(), toggleProgress: vi.fn(),
}));
vi.mock("@/components/office-platform/office-platform", () => ({ OfficePlatform: vi.fn() }));

import { AccessError, requireActor } from "@/lib/platform-access";
import { getOfficePlatformData } from "@/lib/office-platform-data";
import { DeveloperHelp } from "@/components/office-platform/developer-help";
import { OfficeRoute } from "./office-route";
import type { OfficePlatformData } from "@/components/office-platform/types";

const data: OfficePlatformData = {
  page: "help", role: "developer", email: "developer@example.test", projects: [],
  villas: [], buyers: [], tasks: [], payments: [], updates: [], files: [],
  selection: { projectId: "project-a", villaId: null, villaCode: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireActor).mockResolvedValue({ id: "developer-a", role: "developer", email: "developer@example.test", displayName: null });
  vi.mocked(getOfficePlatformData).mockResolvedValue(data);
});

describe("developer Help server route", () => {
  it("provides the server-rendered guide only after authorization and scope checks", async () => {
    const page = await OfficeRoute({ page: "help", searchParams: Promise.resolve({ projectId: "project-a" }) });
    expect(requireActor).toHaveBeenCalledOnce();
    expect(getOfficePlatformData).toHaveBeenCalledWith("help", { projectSlug: undefined, villaCode: undefined, projectId: "project-a" });
    expect(page.props.data).toEqual(data);
    expect(page.props.helpContent.type).toBe(DeveloperHelp);
    expect(page.props.helpContent.props.projectId).toBe("project-a");
  });

  it("rejects a current PM before loading Help data", async () => {
    vi.mocked(requireActor).mockResolvedValue({ id: "pm-a", role: "pm", email: "pm@example.test", displayName: null });
    await expect(OfficeRoute({ page: "help", searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
    expect(getOfficePlatformData).not.toHaveBeenCalled();
  });

  it("redirects buyers before loading Help data", async () => {
    vi.mocked(requireActor).mockResolvedValue({ id: "buyer-a", role: "buyer", email: "buyer@example.test", displayName: null });
    await expect(OfficeRoute({ page: "help", searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/login");
    expect(getOfficePlatformData).not.toHaveBeenCalled();
  });

  it("redirects missing or deleted accounts rather than trusting an old session", async () => {
    vi.mocked(requireActor).mockRejectedValue(new AccessError());
    await expect(OfficeRoute({ page: "help", searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/login");
    expect(getOfficePlatformData).not.toHaveBeenCalled();
  });

  it.each(["", " ", ["project-a", "project-b"]])("rejects malformed project selection %j", async (projectId) => {
    await expect(OfficeRoute({ page: "help", searchParams: Promise.resolve({ projectId }) })).rejects.toThrow("NOT_FOUND");
    expect(getOfficePlatformData).not.toHaveBeenCalled();
  });

  it("does not render Help when the independent data authorization fails", async () => {
    vi.mocked(getOfficePlatformData).mockResolvedValue(null);
    await expect(OfficeRoute({ page: "help", searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  });
});
