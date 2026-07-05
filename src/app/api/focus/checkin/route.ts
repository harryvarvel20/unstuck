import { NextRequest } from "next/server";
import { z } from "zod";
import { buildCheckinPrompt } from "@/lib/gemini";
import { streamGeminiJson } from "@/lib/geminiStream";
import {
  getRequestIdentity,
  consumeFeature,
  checkBurst,
  LIMITS,
  BURST,
} from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({
  phase: z.enum(["start", "midpoint", "complete", "timeup"]),
  stepTitle: z.string().trim().min(1).max(300),
  minutes: z.number().int().min(1).max(120),
});

/**
 * POST /api/focus/checkin — one short streamed message from the body double.
 * Rides on the focus-session limit; a generous per-day safety cap prevents
 * abuse. The client falls back to canned lines on any failure.
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
  if (!(await checkBurst(identity, "aiLight", BURST.aiLight))) {
    return json({ error: "rate_limited" }, 429);
  }
  const cap = await consumeFeature(identity, "ai_light", LIMITS.aiLightPerDay);
  if (!cap.allowed) return json({ error: "limit_reached" }, 429);

  const { phase, stepTitle, minutes } = parsed.data;
  try {
    return streamGeminiJson({
      system: buildCheckinPrompt(phase),
      user: `Step: ${stepTitle}\nSession length: ${minutes} minutes\nPhase: ${phase}`,
      maxTokens: 256,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
