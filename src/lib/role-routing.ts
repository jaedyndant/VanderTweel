// Role-based routing + object-level surface authorization (TO 9.1).
// MS2 klaar-criterium (PvA 4.2): every test account logs in and lands on the
// correct screen. This file is the single source of truth for that mapping —
// both the post-login redirect AND the middleware gate call into it, so there
// is exactly one place that knows "who is allowed where" (TO 1.4).

export type AccountRole = "buyer" | "pm" | "developer";
export type Surface = "koper" | "office" | "office-pm";

const VALID_ROLES: readonly AccountRole[] = ["buyer", "pm", "developer"];

function assertValidRole(role: string): role is AccountRole {
  return (VALID_ROLES as readonly string[]).includes(role);
}

/**
 * Where a freshly-logged-in account should land. Throws on an unrecognized
 * role rather than silently falling back to a default surface — a corrupt or
 * unexpected role value must be an error, never a quiet default (TO 9.1).
 */
export function resolveLandingPath(role: AccountRole): string {
  if (!assertValidRole(role)) {
    throw new Error(`resolveLandingPath: unknown account role "${role}"`);
  }
  switch (role) {
    case "buyer":
      return "/koper";
    case "pm":
    case "developer":
      return "/office";
  }
}

/**
 * Object-level authorization gate: can this role access this surface at all?
 * Called on every request at the API layer (TO 9.1), not only used to pick a
 * redirect target. Fails closed — an unrecognized role is authorized for
 * nothing, never granted access by default.
 */
export function isAuthorizedForSurface(role: AccountRole, surface: Surface): boolean {
  if (!assertValidRole(role)) return false;

  switch (role) {
    case "buyer":
      return surface === "koper";
    case "pm":
      return surface === "office-pm";
    case "developer":
      return surface === "office" || surface === "office-pm";
    default:
      return false;
  }
}
