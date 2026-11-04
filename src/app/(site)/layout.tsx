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

const SITE_URL = "https://van-der-tweel-eight.vercel.app";
const DEFAULT_TITLE = "Van der Tweel · Cemagi Atelier, Bali";
const DEFAULT_DESCRIPTION =
  "A small, thoughtfully crafted collection of villas in Cemagi, Bali. Natural materials, a personal approach to ownership, and a clear view of every step along the way.";
const DEFAULT_OG_IMAGE =
  "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s · Van der Tweel",
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Van der Tweel",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: DEFAULT_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
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
