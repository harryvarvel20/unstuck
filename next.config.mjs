/**
 * Security X1 fix: this app previously shipped ZERO security headers beyond
 * `poweredByHeader: false`. Adds a baseline that's safe to enforce blind
 * (headers, HSTS, frame/clickjacking, MIME-sniffing, referrer, permissions)
 * plus a CSP that closes off exfiltration/clickjacking/base-tag/form-hijack
 * vectors even though it can't yet drop 'unsafe-inline' for script/style —
 * doing that safely needs a nonce-based rewrite verified in a real browser
 * (dynamic inline `style={{...}}` is pervasive across this codebase for
 * progress bars, confetti, emotion colours, etc; Next.js's own RSC-streaming
 * inline scripts also need nonce plumbing). That graduation is tracked as a
 * High-priority follow-up for X2/X4, not shipped unverified here. See
 * reports/SECURITY-REPORT.md.
 */
const SUPABASE_ORIGIN = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : "";
  } catch {
    return "";
  }
})();
const POSTHOG_ORIGIN =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

const csp = [
  "default-src 'self'",
  // TODO(X2/X4, tracked in SECURITY-REPORT.md): move to a per-request nonce
  // and drop 'unsafe-inline' once verified against real hydration + every
  // dynamic inline style in a browser (curl/CI can't detect a CSP violation).
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${POSTHOG_ORIGIN} https://api.stripe.com`.trim(),
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
]
  .join("; ")
  .replace(/\s+/g, " ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // AA1: belt-and-braces — preview/development deployments must never
          // be indexed, even if Deployment Protection is misconfigured or
          // bypassed. VERCEL_ENV is "production" only on the production
          // domain; it is absent locally, so local dev is also marked noindex.
          ...(process.env.VERCEL_ENV === "production"
            ? []
            : [
                {
                  key: "X-Robots-Tag",
                  value: "noindex, nofollow, noarchive",
                },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
