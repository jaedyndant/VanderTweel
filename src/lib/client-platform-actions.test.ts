import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const updateMock = vi.fn();
const setMock = vi.fn();
const whereMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => authMock(...args),
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

vi.mock("@/db/client", () => ({
  db: {
    update: (...args: unknown[]) => updateMock(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  account: { id: "id", notifyEmail: "notifyEmail" },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { updateNotificationPreference } from "./client-platform-actions";

describe("updateNotificationPreference", () => {
  beforeEach(() => {
    authMock.mockReset();
    updateMock.mockReset();
    setMock.mockReset();
    whereMock.mockReset();
    whereMock.mockResolvedValue(undefined);
    setMock.mockReturnValue({ where: whereMock });
    updateMock.mockReturnValue({ set: setMock });
  });

  it("rejects an unauthenticated caller", async () => {
    authMock.mockResolvedValue(null);
    const result = await updateNotificationPreference({ notifyEmail: true });
    expect(result.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a non-buyer session", async () => {
    authMock.mockResolvedValue({ user: { id: "acc-1", role: "pm" } });
    const result = await updateNotificationPreference({ notifyEmail: true });
    expect(result.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid payload", async () => {
    authMock.mockResolvedValue({ user: { id: "acc-1", role: "buyer" } });
    const result = await updateNotificationPreference({ notifyEmail: "not-a-bool-ish" });
    expect(result.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates only the caller's own account row", async () => {
    authMock.mockResolvedValue({ user: { id: "acc-1", role: "buyer" } });
    const result = await updateNotificationPreference({ notifyEmail: false });
    expect(result.ok).toBe(true);
    expect(setMock).toHaveBeenCalledWith({ notifyEmail: false });
    expect(updateMock).toHaveBeenCalled();
  });
});
