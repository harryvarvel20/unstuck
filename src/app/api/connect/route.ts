import { NextRequest } from "next/server";
import { z } from "zod";
import { buildConnectMessagePrompt, buildStretchPrompt } from "@/lib/gemini";
import { streamGeminiJson } from "@/lib/geminiStream";
import { getRequestIdentity, checkBurst, BURST } from "@/lib/quota";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({
  kind: z.enum(["message", "stretch", "goal"]),
  relationship: z.string().trim().max(120).optional().default(""),
  goal: z.string().trim().max(300).optional().default(""),
});

/**
 * POST /api/connect — Pro connection helpers:
 * - kind:"message" streams a warm draft-to-copy (app never sends anything)
 * - kind:"stretch" streams one tiny comfort-zone stretch (matched to profile)
 * - kind:"goal" saves the opt-in comfort-zone goal (or clears it)
 */
export async function POST(req: NextRequest): Promise<Response> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const identity = await getRequestIdentity(req);
  if (!identity.user) return json({ error: "unauthorized" }, 401);
  if (identity.plan !== "pro") return json({ error: "pro_required" }, 402);
  if (!identity.supabase) return json({ error: "unavailable" }, 503);

  if (parsed.data.kind === "goal") {
    const { error } = await identity.supabase
      .from("profiles")
      .update({ connection_goal: parsed.data.goal || null })
      .eq("id", identity.user.id);
    if (error) return json({ error: "save_failed" }, 500);
    return json({ ok: true }, 200);
  }

  if (!(await checkBurst(identity, "aiLight", BURST.aiLight))) {
    return json({ error: "rate_limited" }, 429);
  }

  try {
    if (parsed.data.kind === "message") {
      return streamGeminiJson({
        system: buildConnectMessagePrompt(),
        user: parsed.data.relationship || "someone I care about",
        maxTokens: 200,
      });
    }
    // stretch — match to focus profile triggers
    const { data: profile } = await identity.supabase
      .from("profiles")
      .select("focus_profile")
      .eq("id", identity.user.id)
      .maybeSingle();
    const runsOn =
      profile?.focus_profile &&
      Array.isArray((profile.focus_profile as { runs_on?: unknown }).runs_on)
        ? (profile.focus_profile as { runs_on: string[] }).runs_on
        : [];
    return streamGeminiJson({
      system: buildStretchPrompt(runsOn),
      user: parsed.data.goal || "get out of the house more",
      maxTokens: 200,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
