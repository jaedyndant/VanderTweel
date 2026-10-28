import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Per-request session check — never prerender/cache this layout statically.
export const instant = false;

// Shared nav for the MS4 back-office screens. TO 9.1: server-side auth is
// enforced per-page in office-data.ts/office-actions.ts; this layout only
// renders the nav and bounces out anyone without a pm/developer session —
// middleware already gates /office/:path* too (defense in depth, TO 9.1).
export default async function OfficeLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const user = session?.user as { email?: string; role?: string } | undefined;
  if (!session?.user || (user?.role !== "pm" && user?.role !== "developer")) {
    redirect("/login");
  }
  const role = user!.role as "pm" | "developer";

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">Cemagi Atelier — back-office</span>
          <span className="truncate text-xs text-neutral-500">
            {session.user?.email} · {role === "developer" ? "Ontwikkelaar" : "Projectmanager"}
          </span>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
          <NavLink href="/office">Projecten</NavLink>
          {role === "developer" && <NavLink href="/office/kopers">Kopers</NavLink>}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
    >
      {children}
    </Link>
  );
}
