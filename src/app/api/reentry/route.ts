import { NextRequest } from "next/server";
import { z } from "zod";
import { buildReentryPrompt } from "@/lib/gemini";
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
  stepTitle: z.string().trim().min(1).max(300),
  taskInput: z.string().trim().max(500).optional(),
});

/** POST /api/reentry — a 30-second ramp back into an abandoned task. */
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

  const user = parsed.data.taskInput
    ? `Task: ${parsed.data.taskInput}\nStep they were on: ${parsed.data.stepTitle}`
    : `Step they were on: ${parsed.data.stepTitle}`;

  try {
    return streamGeminiJson({
      system: buildReentryPrompt(),
      user,
      maxTokens: 256,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
