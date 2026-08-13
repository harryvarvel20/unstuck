import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * AA5-D5 regression guard.
 *
 * `streamGeminiJson` used to open the Gemini stream *inside* the
 * ReadableStream's `start`, which runs after a 200 has already been committed.
 * Any upstream failure could then only close an empty body. Client-side,
 * `parseStreamingBreakdown("")` yields zero steps and BreakdownScreen sets
 * status "done" — so the user saw a **successful breakdown containing
 * nothing**, which is worse than an error because it looks like it worked.
 *
 * That behaviour silently hid a complete AI outage on 13 Aug 2026 (Gemini
 * prepay balance hit £0, every call 429'd) from both the operator and the
 * monitoring. These tests pin the fix.
 */

const h = vi.hoisted(() => ({
  generateContentStream: vi.fn(),
}));

vi.mock("@/lib/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gemini")>();
  return {
    ...actual,
    getGemini: () => ({
      models: { generateContentStream: h.generateContentStream },
    }),
  };
});

import { streamGeminiJson, GEMINI_STREAM_TIMEOUT_MS } from "@/lib/geminiStream";

/** Minimal async iterable matching what the SDK yields. */
function fakeStream(chunks: string[]) {
  return (async function* () {
    for (const text of chunks) yield { text };
  })();
}

/**
 * Reject at CALL time, not at mock-setup time. `mockRejectedValue` builds the
 * rejected promise immediately and hands the same one to every call, which
 * Node reports as an unhandled rejection before our code ever awaits it —
 * enough to fail the whole file.
 */
function rejectsWith(err: unknown) {
  h.generateContentStream.mockImplementation(async () => {
    throw err;
  });
}

// These tests deliberately drive the failure path, which logs the upstream
// Error object. Silence it: the noise buries real output, and Vitest treats a
// bare Error passed to console.error as an unhandled test error.
beforeEach(() => {
  h.generateContentStream.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("streamGeminiJson — upstream failure before the response commits", () => {
  it("returns 502, NOT an empty 200", async () => {
    rejectsWith(new Error("boom"));

    const res = await streamGeminiJson({ system: "s", user: "u" });

    expect(
      res.status,
      "An empty 200 renders client-side as a completed breakdown with no " +
        "steps. The failure must reach the client as a failure.",
    ).toBe(502);
    expect(res.status).not.toBe(200);
  });

  it("never returns 429 — that would blame the user for our quota", async () => {
    // streamPost maps 429 -> LimitReachedError -> "you've used your limit".
    // A Gemini quota failure is ours, not the customer's.
    const quota = Object.assign(new Error("RESOURCE_EXHAUSTED"), {
      status: 429,
    });
    rejectsWith(quota);

    const res = await streamGeminiJson({ system: "s", user: "u" });
    expect(res.status).toBe(502);
  });

  it("returns a JSON body the client can distinguish", async () => {
    rejectsWith(new Error("boom"));
    const res = await streamGeminiJson({ system: "s", user: "u" });
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.error).toBe("ai_unavailable");
  });

  it("does not leak the upstream error text to the caller", async () => {
    rejectsWith(
      new Error("API key AIzaSyEXAMPLE is invalid for project 12345"),
    );
    const res = await streamGeminiJson({ system: "s", user: "u" });
    const text = await res.text();
    expect(text).not.toContain("AIzaSy");
    expect(text).not.toContain("project 12345");
  });
});

describe("streamGeminiJson — success path unchanged", () => {
  it("streams 200 with the model's text", async () => {
    h.generateContentStream.mockResolvedValue(
      fakeStream(['{"crisis":false,', '"steps":[]}']),
    );

    const res = await streamGeminiJson({ system: "s", user: "u" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("cache-control")).toContain("no-store");

    expect(await res.text()).toBe('{"crisis":false,"steps":[]}');
  });

  it("passes the abort signal and token ceiling to the model", async () => {
    h.generateContentStream.mockResolvedValue(fakeStream(["{}"]));
    await streamGeminiJson({ system: "s", user: "u", maxTokens: 512 });

    const cfg = h.generateContentStream.mock.calls[0]?.[0]?.config;
    expect(cfg.maxOutputTokens).toBe(512);
    expect(cfg.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(cfg.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("the abort fires before the route's own maxDuration", async () => {
    // Routes declare maxDuration = 60. Aborting first means we fail with a
    // logged error rather than being killed mid-flight by the platform.
    expect(GEMINI_STREAM_TIMEOUT_MS).toBeLessThan(60_000);
  });
});
