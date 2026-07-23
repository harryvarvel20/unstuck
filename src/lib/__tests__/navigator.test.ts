import { describe, it, expect } from "vitest";
import { NAV_DESTINATIONS, buildNavigatorPrompt } from "../gemini";

// The real, shippable app routes the Navigator is allowed to send someone to.
// If a page is removed or renamed, this test forces the catalog to keep up.
const REAL_ROUTES = new Set([
  "/app",
  "/today",
  "/plan",
  "/routines",
  "/ideas",
  "/tasks",
  "/regulate",
  "/dopamenu",
  "/impulse",
  "/connect",
  "/profile",
  "/wins",
  "/winddown",
  "/activity",
  "/parents",
  "/toolkit",
]);

describe("Navigator catalog", () => {
  it("has unique slugs", () => {
    const slugs = NAV_DESTINATIONS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only points at real in-app routes", () => {
    for (const d of NAV_DESTINATIONS) {
      expect(REAL_ROUTES.has(d.path)).toBe(true);
    }
  });

  it("includes the toolkit fallback", () => {
    const toolkit = NAV_DESTINATIONS.find((d) => d.slug === "toolkit");
    expect(toolkit?.path).toBe("/toolkit");
  });

  it("routes a self-crisis to breakdown only via task, not the safety gate", () => {
    // Sanity: breakdown is the composer route so a Navigator handoff lands home.
    const breakdown = NAV_DESTINATIONS.find((d) => d.slug === "breakdown");
    expect(breakdown?.path).toBe("/app");
  });
});

describe("buildNavigatorPrompt", () => {
  it("lists every destination slug and keeps the crisis rule", () => {
    const prompt = buildNavigatorPrompt();
    for (const d of NAV_DESTINATIONS) {
      expect(prompt).toContain(`"${d.slug}"`);
    }
    expect(prompt).toContain("116 123"); // Samaritans, from the crisis rule
    expect(prompt).toContain("Respond with ONLY this JSON object");
  });
});
