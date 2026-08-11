import { describe, it, expect, afterEach } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

/**
 * AA7 regression guards.
 *
 * The one that matters most: the social share cards live under `/api/`. A
 * future tidy-up that blanket-disallows `/api/` in robots.txt would look
 * entirely reasonable in review and would silently break every link preview
 * on Twitter, WhatsApp and Discord — the viral loop AA2 §5 identifies as the
 * growth mechanism. Nothing would error; shares would just stop rendering an
 * image, and nobody would connect it to a robots.txt edit weeks earlier.
 */

const OG_ROUTES = ["/api/og", "/api/icon", "/api/wins-card"];

/** Routes that 307 to /login for anonymous visitors — no crawl value. */
const SIGNED_IN_ROUTES = ["/account", "/activity", "/parents", "/profile"];

afterEach(() => {
  delete process.env.VERCEL_ENV;
});

function firstRule() {
  const rules = robots().rules;
  return Array.isArray(rules) ? rules[0]! : rules;
}

describe("robots.txt", () => {
  it("allows the social share card routes despite disallowing /api/", () => {
    const rule = firstRule();
    const allow = ([] as string[]).concat(rule.allow ?? []);
    const disallow = ([] as string[]).concat(rule.disallow ?? []);

    expect(disallow).toContain("/api/");
    for (const route of OG_ROUTES) {
      expect(
        allow,
        `${route} must stay explicitly allowed. Social crawlers respect ` +
          `robots.txt when fetching og:image, so removing this allow would ` +
          `break every share preview without any error surfacing.`,
      ).toContain(route);
    }
  });

  it("blocks signed-in routes that only redirect", () => {
    const disallow = ([] as string[]).concat(firstRule().disallow ?? []);
    for (const route of SIGNED_IN_ROUTES) {
      expect(disallow).toContain(route);
    }
  });

  it("blocks the transactional post-checkout page", () => {
    const disallow = ([] as string[]).concat(firstRule().disallow ?? []);
    expect(disallow).toContain("/welcome");
  });

  it("points at the sitemap", () => {
    expect(robots().sitemap).toContain("/sitemap.xml");
  });

  it("disallows everything on non-production deployments", () => {
    process.env.VERCEL_ENV = "preview";
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0]! : rules;
    expect(rule.disallow).toBe("/");
    expect(rule.allow).toBeUndefined();
  });
});

describe("sitemap.xml", () => {
  const entries = sitemap();

  it("lists only absolute https URLs", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.url.startsWith("https://")).toBe(true);
    }
  });

  it("never lists a page that redirects or is transactional", () => {
    // A sitemap containing redirects or dead ends devalues the whole file.
    const urls = entries.map((e) => e.url);
    for (const bad of [...SIGNED_IN_ROUTES, "/welcome", "/login"]) {
      expect(
        urls.some((u) => u.endsWith(bad)),
        `${bad} must not appear in the sitemap`,
      ).toBe(false);
    }
  });

  it("gives the landing page top priority", () => {
    const top = entries.find(
      (e) => !e.url.replace("https://", "").includes("/"),
    );
    expect(top?.priority).toBe(1);
  });

  it("agrees with robots.txt — nothing listed is also disallowed", () => {
    const disallow = ([] as string[]).concat(firstRule().disallow ?? []);
    for (const e of entries) {
      const path = "/" + e.url.split("/").slice(3).join("/");
      const clash = disallow.find((d) => d !== "/" && path.startsWith(d));
      expect(
        clash,
        `sitemap lists ${path} but robots.txt disallows ${clash}`,
      ).toBeUndefined();
    }
  });
});
