import { resolveLandingPath } from "@/lib/role-routing";

const LOCAL_ORIGIN = "https://login.local.invalid";

/** Only explicit local app paths, never external or protocol-relative URLs. */
export function safeLoginCallback(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return null;
  try {
    const url = new URL(value, LOCAL_ORIGIN);
    if (
      url.origin !== LOCAL_ORIGIN ||
      !/^\/(?:office|koper)(?:\/|$)/.test(url.pathname) ||
      /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(url.pathname)
    )
      return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Roles are read from the authenticated server session, never a form field. */
export function authenticatedLoginDestination(
  role: unknown,
  callback: unknown,
): string | null {
  if (role !== "buyer" && role !== "pm" && role !== "developer") return null;
  const landing = resolveLandingPath(role);
  const safe = safeLoginCallback(callback);
  return safe &&
    (safe === landing ||
      safe.startsWith(`${landing}/`) ||
      safe.startsWith(`${landing}?`) ||
      safe.startsWith(`${landing}#`))
    ? safe
    : landing;
}
