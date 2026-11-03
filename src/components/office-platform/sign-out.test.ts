import { beforeEach, describe, expect, it, vi } from "vitest";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  signOut: signOutMock,
}));
vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({ account: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { submitOfficeSignOut } from "./sign-out";

describe("backoffice sign-out", () => {
  beforeEach(() => {
    signOutMock.mockReset();
  });

  it("invalidates the Auth.js session before preserving Next's login redirect", async () => {
    signOutMock.mockResolvedValue(undefined);

    // Uses the existing server action and real Next redirect/rethrow behavior,
    // while replacing Auth.js only so there are no cookie or database writes.
    await expect(submitOfficeSignOut()).rejects.toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT;[^;]+;\/login;/),
    });
    expect(signOutMock).toHaveBeenCalledExactlyOnceWith({ redirect: false });
  });

  it("does not navigate until session invalidation completes", async () => {
    let finish: (() => void) | undefined;
    signOutMock.mockImplementation(
      () => new Promise<void>((resolve) => { finish = resolve; }),
    );
    let completed = false;
    const result = submitOfficeSignOut().then(
      () => { completed = true; },
      (error: unknown) => { completed = true; return error; },
    );

    await Promise.resolve();
    expect(completed).toBe(false);
    finish?.();
    await expect(result).resolves.toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT;[^;]+;\/login;/),
    });
  });

  it("returns a retryable error when invalidation fails, then permits retry", async () => {
    signOutMock.mockRejectedValueOnce(new Error("Session invalidation failed"));
    await expect(submitOfficeSignOut()).resolves.toBe(
      "Could not sign out. Please try again.",
    );

    signOutMock.mockResolvedValueOnce(undefined);
    await expect(submitOfficeSignOut()).rejects.toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT;[^;]+;\/login;/),
    });
    expect(signOutMock).toHaveBeenCalledTimes(2);
  });
});
