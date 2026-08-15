import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { computePatterns } from "@/lib/patterns";
import { getTimeTruth, ratioIsNotable } from "@/lib/timeTruth";

export const runtime = "nodejs";
export const maxDuration = 15;
export const dynamic = "force-dynamic";

/**
 * GET /api/patterns?tz=<Date.getTimezoneOffset()>
 *
 * What the app has noticed about you, computed from your own completed steps
 * and focus sessions.
 *
 * **Deliberately calls no model.** Every other reflective surface in ADHV asks
 * Gemini to say something about the user; this reads what they actually did.
 * That makes it free, instant, private (nothing leaves our infrastructure),
 * and — the part that matters — *true*. It also means it keeps working when
 * the AI is down, which on 13 Aug 2026 it was, for an hour, silently.
 */

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  // Client's UTC offset in minutes. Timestamps are stored in UTC, and
  // "you get going around 9am" is wrong in every timezone but one.
  const raw = Number(req.nextUrl.searchParams.get("tz"));
  const tz = Number.isFinite(raw) && Math.abs(raw) <= 900 ? raw : 0;

  try {
    const [result, truth] = await Promise.all([
      computePatterns(supabase, user.id, tz),
      getTimeTruth(supabase, user.id),
    ]);

    const patterns = [...result.patterns];

    // Time Truth is the oldest observation in the app and still the sharpest.
    // Only shown when the gap is big enough to be worth mentioning.
    if (truth.enough && ratioIsNotable(truth.ratio)) {
      const slower = truth.ratio > 1;
      const factor = slower
        ? Math.round(truth.ratio * 10) / 10
        : Math.round((1 / truth.ratio) * 10) / 10;
      patterns.push({
        id: "time-truth",
        emoji: "⏱️",
        headline: slower
          ? `Things take you about ${factor}× longer than you expect.`
          : `You're about ${factor}× quicker than you expect.`,
        detail: slower
          ? "Not a flaw — a measurement. ADHV already pads your estimates using this, so the plan matches the real you."
          : "You're harder on yourself than the clock is. Your plans already account for it.",
      });
    }

    return json({ patterns, samples: result.samples });
  } catch (err) {
    console.error("patterns failed:", err);
    return json({ error: "server_error" }, 500);
  }
}
