import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { CRISIS_SIGNPOST, CHILD_SAFETY_SIGNPOST } from "@/lib/safety";

/**
 * Z1 route tests — /api/navigate with a MOCKED Gemini.
 * Proves: deterministic crisis/safeguarding gates fire BEFORE any AI call;
 * the model can only ever route to catalog slugs (hallucinations fall back
 * to /toolkit); malformed model output degrades safely; rate limits apply.
 */

const h = vi.hoisted(() => ({
  generateContent: vi.fn<(...a: unknown[]) => Promise<{ text: string }>>(),
  checkBurst: vi.fn(async () => true),
  consumeFeature: vi.fn(async () => ({
    allowed: true,
    count: 0,
    enforced: true,
  })),
}));

vi.mock("@/lib/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gemini")>();
  return {
    ...actual,
    getGemini: () => ({ models: { generateContent: h.generateContent } }),
  };
});

vi.mock("@/lib/quota", () => ({
  getRequestIdentity: vi.fn(async () => ({
    user: null,
    plan: "free",
    subject: "ip:test",
    supabase: null,
  })),
  checkBurst: (...a: unknown[]) => h.checkBurst(...(a as [])),
  consumeFeature: (...a: unknown[]) => h.consumeFeature(...(a as [])),
  LIMITS: { aiLightPerDay: 60, focusPerDay: 1 },
  BURST: { aiLight: 20, breakdown: 8 },
}));

import { POST } from "@/app/api/navigate/route";

function req(body: unknown): NextRequest {
  return new NextRequest("http://test.local/api/navigate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.generateContent.mockReset();
  h.checkBurst.mockResolvedValue(true);
  h.consumeFeature.mockResolvedValue({
    allowed: true,
    count: 0,
    enforced: true,
  });
});

describe("/api/navigate — safety gates run BEFORE the AI", () => {
  it("crisis language → Samaritans signpost, model never called", async () => {
    const res = await POST(req({ query: "I want to kill myself" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.crisis).toBe(true);
    expect(body.message).toBe(CRISIS_SIGNPOST);
    expect(h.generateContent).not.toHaveBeenCalled();
  });

  it("child-safety language → safeguarding signpost, model never called", async () => {
    const res = await POST(req({ query: "I keep hitting my child" }));
    const body = await res.json();
    expect(body.crisis).toBe(true);
    expect(body.message).toBe(CHILD_SAFETY_SIGNPOST);
    expect(h.generateContent).not.toHaveBeenCalled();
  });
});

describe("/api/navigate — routing is catalog-locked", () => {
  it("maps a valid slug to its route", async () => {
    h.generateContent.mockResolvedValue({
      text: JSON.stringify({
        crisis: false,
        slug: "regulate",
        task: "",
        reason: "Let's cool down.",
      }),
    });
    const body = await (
      await POST(req({ query: "I'm so overwhelmed" }))
    ).json();
    expect(body.route).toBe("/regulate");
  });

  it("breakdown slug carries the task as an intent prefill", async () => {
    h.generateContent.mockResolvedValue({
      text: JSON.stringify({
        crisis: false,
        slug: "breakdown",
        task: "file my tax return",
        reason: "Tiny first step.",
      }),
    });
    const body = await (await POST(req({ query: "do my taxes" }))).json();
    expect(body.route).toBe(
      `/app?intent=${encodeURIComponent("file my tax return")}`,
    );
  });

  it("a hallucinated slug falls back to /toolkit", async () => {
    h.generateContent.mockResolvedValue({
      text: JSON.stringify({ crisis: false, slug: "evil-route", task: "" }),
    });
    const body = await (await POST(req({ query: "help me" }))).json();
    expect(body.route).toBe("/toolkit");
  });

  it("unparseable model output falls back to /toolkit", async () => {
    h.generateContent.mockResolvedValue({ text: "<<not json>>" });
    const body = await (await POST(req({ query: "help me" }))).json();
    expect(body.route).toBe("/toolkit");
  });

  it("a model-side crisis flag still signposts (backstop)", async () => {
    h.generateContent.mockResolvedValue({
      text: JSON.stringify({ crisis: true, message: "please reach out" }),
    });
    const body = await (await POST(req({ query: "something oblique" }))).json();
    expect(body.crisis).toBe(true);
  });
});

describe("/api/navigate — limits and validation", () => {
  it("burst limit → 429", async () => {
    h.checkBurst.mockResolvedValue(false);
    const res = await POST(req({ query: "route me" }));
    expect(res.status).toBe(429);
    expect(h.generateContent).not.toHaveBeenCalled();
  });

  it("daily cap → 429", async () => {
    h.consumeFeature.mockResolvedValue({
      allowed: false,
      count: 60,
      enforced: true,
    });
    const res = await POST(req({ query: "route me" }));
    expect(res.status).toBe(429);
  });

  it("empty / oversize input → 400", async () => {
    expect((await POST(req({ query: "" }))).status).toBe(400);
    expect((await POST(req({ query: "x".repeat(301) }))).status).toBe(400);
  });
});
