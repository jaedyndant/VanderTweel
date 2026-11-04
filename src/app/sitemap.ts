import type { MetadataRoute } from "next";

// Static sitemap for the public marketing site ((site) route group) only.
// Deliberately hardcoded (not read from the DB) so sitemap generation never
// needs a database connection at build time — matches the "no build-time DB
// read" rule already established for (site) pages. Villa slugs are the two
// residences currently in the collection (villa-1, villa-3); update this
// list if the collection grows. Never list (koper)/(office) routes here —
// those are authenticated, not public marketing pages.
const SITE_URL = "https://van-der-tweel-eight.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    { path: "/", priority: 1 },
    { path: "/atelier", priority: 0.8 },
    { path: "/ownership", priority: 0.8 },
    { path: "/villas", priority: 0.9 },
    { path: "/villas/villa-1", priority: 0.7 },
    { path: "/villas/villa-3", priority: 0.7 },
    { path: "/contact", priority: 0.6 },
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: route.priority,
  }));
}
