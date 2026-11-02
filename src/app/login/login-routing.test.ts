import { describe, expect, it } from "vitest";
import {
  authenticatedLoginDestination,
  safeLoginCallback,
} from "./login-routing";

describe("login return paths", () => {
  it.each([
    "/office",
    "/office/villas/Villa%2003/voortgang?projectId=project-1",
    "/koper/betaalschema?villa=villa-3#milestones",
    "/koper?event=update",
  ])("preserves a legitimate local app callback: %s", (value) => {
    expect(safeLoginCallback(value)).toBe(value);
  });

  it.each([
    "https://external.invalid/office",
    "//external.invalid/office",
    "/\\external.invalid/office",
    "/office\\..\\external.invalid",
    "javascript:alert(1)",
    "/office-tools",
    "/login",
    "/",
    "/office/../../outside",
    "/office/%2e%2e/login",
    "/office/%2f%2fexternal.invalid",
    "/office/%5cexternal.invalid",
    "/office\n/anything",
    "/office/%0d%0aLocation:external.invalid",
    ["/office", "/koper"],
    undefined,
    null,
  ])("rejects invalid or external callbacks: %s", (value) => {
    expect(safeLoginCallback(value)).toBeNull();
  });

  it("uses existing role landing paths for direct logins", () => {
    expect(authenticatedLoginDestination("buyer", null)).toBe("/koper");
    expect(authenticatedLoginDestination("pm", null)).toBe("/office");
    expect(authenticatedLoginDestination("developer", null)).toBe("/office");
  });

  it("preserves a deep link only within the authenticated role's surface", () => {
    expect(
      authenticatedLoginDestination(
        "pm",
        "/office/villas/A/voortgang?projectId=p1",
      ),
    ).toBe("/office/villas/A/voortgang?projectId=p1");
    expect(
      authenticatedLoginDestination("buyer", "/koper/updates?villa=v1"),
    ).toBe("/koper/updates?villa=v1");
    expect(authenticatedLoginDestination("buyer", "/office")).toBe("/koper");
    expect(authenticatedLoginDestination("developer", "/koper")).toBe(
      "/office",
    );
  });

  it("never invents a role for an unauthenticated or invalid session", () => {
    expect(authenticatedLoginDestination(undefined, "/office")).toBeNull();
    expect(authenticatedLoginDestination("admin", "/office")).toBeNull();
  });
});
