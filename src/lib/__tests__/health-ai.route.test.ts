import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * AA5 follow-up. `/api/health` only checks the database, and on 13 Aug 2026 it
 * returned 200 for an hour while every Gemini call failed with a 429 — the
 * core feature was dead and no monitor could see it.
 *
 * The properties that matter here are the ones a monitor depends on: a real
 * failure must produce a **5xx**, and nothing about the upstream error may
 * reach a public response.
 */

const h = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@/lib/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gemini")>();
  return {
    ...actual,
    getGemini: () => ({ models: { generateContent: h.generateContent } }),
  };
});

beforeEach(() => {
  vi.resetModules(); // clear the module-level cache between tests
  h.generateContent.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

/** Import fresh so the module-scope cache starts empty. */
async function loadRoute() {
  return (await import("@/app/api/health/ai/route")).GET;
}

describe("/api/health/ai", () => {
  it("returns 200 when Gemini answers", async () => {
    h.generateContent.mockResolvedValue({ text: "k" });
    const GET = await loadRoute();

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ai).toBe(true);
  });

  it("returns 503 — not 200 — when Gemini fails", async () => {
    h.generateContent.mockImplementation(async () => {
      throw new Error("RESOURCE_EXHAUSTED");
    });
    const GET = await loadRoute();

    const res = await GET();
    expect(
      res.status,
      "Monitors alert on status code. A 200 carrying {ai:false} would never " +
        "page anyone — which is exactly how the 13 Aug outage stayed hidden.",
    ).toBe(503);
    const body = await res.json();
    expect(body.ai).toBe(false);
  });

  it("never leaks upstream error detail to a public caller", async () => {
    h.generateContent.mockImplementation(async () => {
      throw new Error("API key AIzaSyEXAMPLE invalid for project 12345");
    });
    const GET = await loadRoute();

    const text = await (await GET()).text();
    expect(text).not.toContain("AIzaSy");
    expect(text).not.toContain("project 12345");
  });

  it("caches, so polling cannot run up Gemini spend", async () => {
    h.generateContent.mockResolvedValue({ text: "k" });
    const GET = await loadRoute();

    await GET();
    await GET();
    await GET();

    // The endpoint is unauthenticated by necessity; without the cache anyone
    // could drive paid API calls at will.
    expect(h.generateContent).toHaveBeenCalledTimes(1);

    const body = await (await GET()).json();
    expect(body.cached).toBe(true);
  });

  it("asks the model for a single token only", async () => {
    h.generateContent.mockResolvedValue({ text: "k" });
    const GET = await loadRoute();
    await GET();

    const cfg = h.generateContent.mock.calls[0]?.[0]?.config;
    expect(cfg.maxOutputTokens).toBe(1);
    expect(cfg.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(cfg.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("is never cached by a CDN", async () => {
    h.generateContent.mockResolvedValue({ text: "k" });
    const GET = await loadRoute();
    const res = await GET();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
