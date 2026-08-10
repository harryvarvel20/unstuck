import { NextRequest } from "next/server";
import { z } from "zod";
import { buildDopamenuPrompt } from "@/lib/gemini";
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
  text: z.string().trim().max(1000).default(""),
  refresh: z.boolean().default(false),
});

/** POST /api/dopamenu/suggest — AI menu candidates (Pro). Streamed. */
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
  if (!(await checkBurst(identity, "aiLight", BURST.aiLight))) {
    return json({ error: "rate_limited" }, 429);
  }

  try {
    return streamGeminiJson({
      system: buildDopamenuPrompt(parsed.data.refresh),
      user:
        parsed.data.text ||
        "I'm not sure — suggest a playful starter menu of things that lift most people.",
      maxTokens: 900,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
