import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { execFileSync } from "node:child_process";
import path from "node:path";

const isDev = process.env.NODE_ENV === "development";

// Security headers applied to every response. Next/Vercel set none of
// these by default; without them the app has no clickjacking, MIME-sniffing
// or referrer-leak protection at all.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS: Vercel terminates TLS at the edge for every production request,
  // so this is safe to send unconditionally.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    // Next's prerendered shells require inline bootstrap scripts. A per-request
    // nonce is incompatible with the current Cache Components/PPR setup, so use
    // Next's documented non-nonce policy without changing rendering behavior:
    // https://nextjs.org/docs/app/guides/content-security-policy#without-nonces
    // Tradeoff: 'unsafe-inline' permits arbitrary inline script blocks, not only
    // Next's scripts. This is not strict XSS protection; adopting nonce-based
    // CSP needs a separately planned dynamic-rendering change. Attribute event
    // handlers remain blocked via script-src-attr in supporting browsers.
    // React's development diagnostics require eval; production does not.
    // Inline styles support Next's font/critical CSS injection. Images retain
    // the existing HTTPS allowance for reference photos and uploaded file URLs.
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data:",
      "font-src 'self' data:",
      // Direct uploads use the official @vercel/blob API. Permit only its
      // exact root and descendants; private downloads remain same-origin.
      "connect-src 'self' https://vercel.com/api/blob https://vercel.com/api/blob/",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingIncludes: {
    "/api/billing/documents/*": ["./src/lib/billing/fonts/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default function configureNext(phase: string): NextConfig {
  // Runs even when hosting overrides the npm build command with `next build`.
  if (phase === PHASE_PRODUCTION_BUILD && process.env.VERCEL_ENV === "production") {
    execFileSync(process.execPath, [path.join(process.cwd(), "scripts/check-release-schema.mjs")], { stdio: "inherit" });
  }
  return nextConfig;
}
