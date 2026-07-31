import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { CRISIS_SIGNPOST } from "@/lib/safety";

/**
 * Z1-D4 regression — /api/social/assist previously sent tone-guard text and
 * playbook drafts to the model with NO deterministic crisis gate (and the
 * tone-guard prompt intentionally carries no crisis rule). These tests fail
 * against the old route and pass against the fixed one: crisis text must
 * short-circuit BEFORE any AI call, on both assist kinds.
 */

const h = vi.hoisted(() => ({
  generateContent: vi.fn(async () => ({
    text: JSON.stringify({ kind: true }),
  })),
}));

vi.mock("@/lib/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gemini")>();
  return {
    ...actual,
    getGemini: () => ({ models: { generateContent: h.generateContent } }),
  };
});

vi.mock("@/lib/socialServer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/socialServer")>();
  return {
    ...actual,
    getSocialContext: async () => ({
      db: {},
      userId: "user-a",
      plan: "pro",
      parentsMode: false,
      profile: { handle_set: true },
    }),
  };
});

vi.mock("@/lib/quota", () => ({
  checkBurst: async () => true,
  consumeFeature: async () => ({ allowed: true, count: 0, enforced: true }),
  LIMITS: { aiLightPerDay: 60, focusPerDay: 1 },
  BURST: { aiLight: 20, breakdown: 8 },
}));

import { POST } from "@/app/api/social/assist/route";

function req(body: unknown): NextRequest {
  return new NextRequest("http://test.local/api/social/assist", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => h.generateContent.mockClear());

describe("/api/social/assist — deterministic crisis gate before ANY AI call", () => {
  it("toneguard: crisis text → signpost, model never called", async () => {
    const res = await POST(
      req({ kind: "toneguard", text: "I can't go on anymore" }),
    );
    const body = await res.json();
    expect(body.crisis).toBe(true);
    expect(body.message).toBe(CRISIS_SIGNPOST);
    expect(h.generateContent).not.toHaveBeenCalled();
  });

  it("playbook: crisis text in title/steps → signpost, model never called", async () => {
    const res = await POST(
      req({
        kind: "playbook",
        title: "how I stopped wanting to hurt myself",
        steps: ["step one"],
      }),
    );
    const body = await res.json();
    expect(body.crisis).toBe(true);
    expect(h.generateContent).not.toHaveBeenCalled();
  });

  it("benign toneguard text still reaches the model (fail-open helper)", async () => {
    const res = await POST(
      req({ kind: "toneguard", text: "nice one, proud of you" }),
    );
    const body = await res.json();
    expect(body.kind).toBe(true);
    expect(h.generateContent).toHaveBeenCalledTimes(1);
  });
});
