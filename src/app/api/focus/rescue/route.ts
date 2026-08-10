import { NextRequest } from "next/server";
import { z } from "zod";
import { buildSystemPrompt, buildUserContent } from "@/lib/gemini";
import { streamGeminiJson } from "@/lib/geminiStream";
import {
  getRequestIdentity,
  consumeFeature,
  checkBurst,
  LIMITS,
  BURST,
} from "@/lib/quota";
import { MAX_INPUT_CHARS } from "@/lib/constants";

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
  input: z.string().trim().min(1).max(MAX_INPUT_CHARS),
});

/**
 * POST /api/focus/rescue — "Struggling" pressed mid-session. Shrinks the
 * current step into 1–3 laughably tiny micro-moves. Doesn't consume a
 * breakdown credit (it's part of the focus session); capped by ai_light.
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

  try {
    return streamGeminiJson({
      system: buildSystemPrompt({ mode: "rescue", input: parsed.data.input }),
      user: buildUserContent(parsed.data.input),
      maxTokens: 512,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
