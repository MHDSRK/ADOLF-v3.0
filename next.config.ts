import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Baseline security headers applied to every response.
 *
 * CSP is enforced. Inline styles remain allowed because the app uses Tailwind
 * style attributes. Scripts are restricted to same-origin code, with eval
 * allowed only in development for the Next.js dev runtime.
 *
 * The rest of the headers are straight blocks, safe to enforce today:
 *   - HSTS: only meaningful on HTTPS (no-op on http://localhost).
 *   - X-Content-Type-Options / X-Frame-Options / Referrer-Policy:
 *     baseline OWASP hardening, no behavioural cost.
 *   - Permissions-Policy: we don't use camera / microphone / etc, so
 *     deny them. A supply-chain compromise or a forgotten plugin
 *     can't silently opt back in.
 */
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // Microphone is allowed only for same-origin (`self`) because the
    // inbox composer records voice notes. Camera, geolocation and other
    // sensitive capabilities stay denied.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "media-src 'self' blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
] as const;

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the
  // Docker image can run without node_modules or the Next CLI.
  // Harmless outside Docker: `next start` keeps working as before.
  output: "standalone",

  /**
   * Cross-origin dev access (Next.js 16).
   *
   * Next 16 blocks requests to dev-only resources (`/_next/*` internals,
   * the HMR websocket, the dev overlay) unless the browser's Origin is
   * the host the dev server booted on — `localhost` by default. Tunnels
   * like ngrok serve the app from a public HTTPS host, so without
   * allow-listing that host those dev requests come back 403: HMR stops
   * working and the dev session degrades over the tunnel (issue #365).
   *
   * No tunnel origins are trusted by default. Add a development tunnel
   * explicitly via `ALLOWED_DEV_ORIGINS` (comma-separated). This key is
   * dev-only and has no effect on a production build.
   */
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [],

  /**
   * Cache-Control policy.
   *
   * - /api/*          — no-store. API responses are per-user and must
   *     never be shared across requests at the edge.
   * - Everything else — private, no-store, max-age=0. Dashboard and
   *     other application responses are user/account scoped and should
   *     not be cached by browsers or shared intermediaries.
   * - /_next/static/* — leave to Next. Hashed static assets keep the
   *     framework's normal caching behavior.
   *
   * Security headers are appended via a separate catch-all rule below;
   * Next.js merges headers from every matching rule, so they apply to
   * every response regardless of which cache rule matched.
   */
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/:path((?!_next/static|_next/image|api).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0",
          },
        ],
      },
      {
        // Security headers on every response, including /_next/static
        // assets (nosniff matters there) and /api/* (HSTS + referrer-
        // policy don't hurt).
        source: "/:path*",
        headers: [...SECURITY_HEADERS],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
