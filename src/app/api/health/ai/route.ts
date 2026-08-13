import { BREAKDOWN_MODEL, getGemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 15;
export const dynamic = "force-dynamic";

/**
 * GET /api/health/ai — liveness check for the Gemini path (AA5 follow-up).
 *
 * `/api/health` only exercises the database. On 13 Aug 2026 it returned 200
 * for an hour while every AI call failed with a 429 (prepay balance at £0) —
 * the core feature was completely dead and nothing could see it. This closes
 * that blind spot.
 *
 * **Deliberately a separate endpoint** rather than part of `/api/health`:
 *   - `/api/health` is polled every ~5 min and must stay free and instant.
 *   - A Gemini blip should not page someone as though the database were down.
 *     Two endpoints mean the alert names the failure.
 * Monitor this one at a lower frequency (10–15 min is ample).
 *
 * Cost: one generation capped at a single output token — on the order of
 * $0.00001 per call, so even at 5-minute intervals it is a rounding error
 * against the AA8 model.
 */

/**
 * The endpoint is unauthenticated (a monitor cannot sign in), so a cached
 * result bounds both cost and abuse: hammering it cannot drive Gemini spend
 * beyond roughly one call per instance per minute. Module scope survives
 * between invocations on a warm fluid-compute instance.
 */
const CACHE_MS = 60_000;
let cached: { ok: boolean; at: number } | null = null;

async function pingModel(): Promise<boolean> {
  try {
    const ai = getGemini();
    await ai.models.generateContent({
      model: BREAKDOWN_MODEL,
      contents: "ok",
      config: {
        maxOutputTokens: 1,
        thinkingConfig: { thinkingBudget: 0 },
        abortSignal: AbortSignal.timeout(10_000),
      },
    });
    return true;
  } catch (err) {
    // Logged, never returned — this endpoint is public and an upstream message
    // can name the API key or project.
    console.error("health/ai: gemini check failed:", err);
    return false;
  }
}

export async function GET(): Promise<Response> {
  const started = Date.now();

  let ok: boolean;
  let fresh = false;
  if (cached && Date.now() - cached.at < CACHE_MS) {
    ok = cached.ok;
  } else {
    ok = await pingModel();
    cached = { ok, at: Date.now() };
    fresh = true;
  }

  return new Response(
    JSON.stringify({
      status: ok ? "ok" : "degraded",
      ai: ok,
      cached: !fresh,
      ms: Date.now() - started,
    }),
    {
      // 503 so an uptime monitor alerts — monitors watch status codes, and a
      // 200 carrying {"ai":false} would never page anybody.
      status: ok ? 200 : 503,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store, no-transform",
      },
    },
  );
}
