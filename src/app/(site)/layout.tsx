import type { Metadata } from "next";
import type { ReactNode } from "react";
import { clientSans, clientSerif } from "@/fonts";
import SiteNav from "@/components/site/site-nav";
import SiteFooter from "@/components/site/site-footer";
import "@/components/site/site.css";

// Villa data is read live from Postgres on every request (same pattern as
// the (koper) layout) — never statically cached/prerendered, so pricing,
// status and handover dates can never go stale on the public site.
export const instant = false;

export const metadata: Metadata = {
  title: {
    default: "Van der Tweel · Cemagi Atelier, Bali",
    template: "%s · Van der Tweel",
  },
  description:
    "A small, thoughtfully crafted collection of villas in Cemagi, Bali. Natural materials, a personal approach to ownership, and a clear view of every step along the way.",
};

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${clientSans.variable} ${clientSerif.variable} site-platform site-shell`}
    >
      <SiteNav />
      <main className="site-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
