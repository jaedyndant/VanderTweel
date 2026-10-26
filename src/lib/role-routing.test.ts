import { describe, it, expect } from "vitest";
import { resolveLandingPath, isAuthorizedForSurface } from "./role-routing";

// MS2 klaar-criterium (PvA 4.2): "Elk testaccount logt in en komt op het juiste
// scherm uit." Written before the implementation per TO 11.2 (TDD for role-based
// access — highest-risk logic in the whole platform per TO 11.1/11.3).

describe("resolveLandingPath", () => {
  it("routes a buyer to the koper-app", () => {
    expect(resolveLandingPath("buyer")).toBe("/koper");
  });

  it("routes a project manager to the back-office (pm view)", () => {
    expect(resolveLandingPath("pm")).toBe("/office");
  });

  it("routes a developer to the back-office (full view)", () => {
    expect(resolveLandingPath("developer")).toBe("/office");
  });

  it("throws on an unknown/invalid role instead of silently defaulting", () => {
    // Silent fallback here would be a security bug: an account with a corrupt
    // or unexpected role must never land on a surface by accident.
    expect(() => resolveLandingPath("admin" as never)).toThrow();
    expect(() => resolveLandingPath("" as never)).toThrow();
  });
});

describe("isAuthorizedForSurface — object-level role gate (TO 9.1)", () => {
  it("a buyer may only access the koper surface", () => {
    expect(isAuthorizedForSurface("buyer", "koper")).toBe(true);
    expect(isAuthorizedForSurface("buyer", "office")).toBe(false);
    expect(isAuthorizedForSurface("buyer", "office-pm")).toBe(false);
  });

  it("a pm may access the limited office-pm surface but not full office or koper", () => {
    expect(isAuthorizedForSurface("pm", "office-pm")).toBe(true);
    expect(isAuthorizedForSurface("pm", "office")).toBe(false);
    expect(isAuthorizedForSurface("pm", "koper")).toBe(false);
  });

  it("a developer may access the full office surface (and the pm-limited one)", () => {
    expect(isAuthorizedForSurface("developer", "office")).toBe(true);
    expect(isAuthorizedForSurface("developer", "office-pm")).toBe(true);
    expect(isAuthorizedForSurface("developer", "koper")).toBe(false);
  });

  it("never grants access for an unrecognized role (fail closed, not open)", () => {
    expect(isAuthorizedForSurface("bogus" as never, "koper")).toBe(false);
    expect(isAuthorizedForSurface("bogus" as never, "office")).toBe(false);
  });
});
