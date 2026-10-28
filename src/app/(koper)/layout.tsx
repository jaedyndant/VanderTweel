import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Per-request session check — never prerender/cache this layout statically.
export const instant = false;

// Shared nav for the 3 MS3 koper-app screens (TO 9.1: server-side auth is
// enforced per-page in koper-data.ts; this layout only renders the nav and
// bounces out anyone without a session — middleware already does this too,
// defense in depth per TO 9.1).
export default async function KoperLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">Cemagi Atelier</span>
          <span className="truncate text-xs text-neutral-500">{session.user.email}</span>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
          <NavLink href="/koper">Mijn villa</NavLink>
          <NavLink href="/koper/voortgang">Voortgang</NavLink>
          <NavLink href="/koper/betaalschema">Betaalschema</NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
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
