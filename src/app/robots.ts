import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://adhvtool.com";

/**
 * robots.txt (AA7). There was none — crawlers were falling back to "index
 * everything", including the twenty-odd signed-in routes that just 307 to
 * /login. That wastes crawl budget on redirects and risks login pages
 * appearing in results instead of the product.
 *
 * ⚠️ The `/api/og`, `/api/icon` and `/api/wins-card` allows are NOT
 * decorative. Blanket-disallowing `/api/` would be the obvious thing to write
 * and it would quietly break every social share preview: Twitterbot and
 * several other social crawlers respect robots.txt when fetching `og:image`,
 * and those three routes ARE the share cards. AA2 §5 identifies them as the
 * viral loop for exactly this reason. Crawlers apply longest-match-wins, so
 * the specific allows beat the general `/api/` disallow.
 *
 * Non-production deployments disallow everything, reinforcing the
 * `X-Robots-Tag: noindex` header added in AA1 — belt and braces, since a
 * preview URL leaking into an index is very hard to undo.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og", "/api/icon", "/api/wins-card"],
        disallow: [
          // Everything else server-side. No crawl value, and some of it costs
          // money to render.
          "/api/",
          "/auth/",
          // Signed-in surfaces: these 307 to /login for anonymous visitors.
          "/account",
          "/activity",
          "/parents",
          "/profile",
          "/connect",
          "/plan",
          "/tasks",
          "/today",
          "/wins",
          "/winddown",
          "/routines",
          "/dopamenu",
          "/ideas",
          "/impulse",
          "/regulate",
          // Post-checkout confirmation — transactional, carries a session id.
          "/welcome",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
