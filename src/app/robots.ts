import type { MetadataRoute } from "next";

// Public marketing site only: allow crawling of the public (site) routes,
// disallow the (koper)/(office) owner- and staff-authenticated apps so
// search engines never try to index behind-login pages.
const SITE_URL = "https://van-der-tweel-eight.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/login", "/koper", "/office"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
