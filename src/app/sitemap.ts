import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://adhvtool.com";

/**
 * sitemap.xml (AA7). There was none, so search engines had no map of the
 * site at all before launch.
 *
 * Only genuinely public, indexable pages are listed. Every route here was
 * verified to return 200 to an anonymous request — a sitemap that lists a
 * redirect or a 404 damages trust in the whole file.
 *
 * Deliberately excluded: `/login` (no search value, and it would compete with
 * the landing page for brand queries), `/welcome` (transactional, carries a
 * checkout session id), and every signed-in route (they 307 to /login).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    // The landing page — the one that should rank for brand and problem terms.
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    // The product itself. Usable without an account, so it is a real entry
    // point rather than a gated page.
    {
      url: `${BASE}/app`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE}/toolkit`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE}/guidelines`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/accessibility`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${BASE}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
