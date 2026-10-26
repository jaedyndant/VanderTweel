import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveLandingPath, type Surface } from "@/lib/role-routing";

// TO 9.1: authorization enforced at the API/middleware layer, never only by
// hiding UI — a buyer putting /office in the URL bar must be bounced here,
// not merely by the office nav not showing a link.

const SURFACE_BY_PATH_PREFIX: Array<[string, Surface]> = [
  ["/koper", "koper"],
  ["/office", "office"],
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const match = SURFACE_BY_PATH_PREFIX.find(([prefix]) => pathname.startsWith(prefix));
  if (!match) return NextResponse.next();

  const [, surface] = match;
  const role = (req.auth?.user as { role?: "buyer" | "pm" | "developer" } | undefined)?.role;

  if (!role) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // office-pm vs office (full) is resolved further inside the (office) route
  // group itself per-screen (TO 1.3: pm sees 3 limited screens, developer
  // sees 9) — middleware only gates the top-level surface boundary: buyer to
  // /koper, pm+developer to /office.
  const allowed =
    surface === "koper" ? role === "buyer" : role === "pm" || role === "developer";

  if (!allowed) {
    return NextResponse.redirect(new URL(resolveLandingPath(role), req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/koper/:path*", "/office/:path*"],
};
