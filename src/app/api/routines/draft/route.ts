import { NextRequest } from "next/server";
import { z } from "zod";
import { buildRoutinePrompt } from "@/lib/gemini";
import { streamGeminiJson } from "@/lib/geminiStream";
import { getRequestIdentity, checkBurst, BURST } from "@/lib/quota";
import { getTimeTruth } from "@/lib/timeTruth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({
  when: z.string().trim().max(200).default(""),
  must: z.string().trim().max(500).default(""),
  wrong: z.string().trim().max(500).default(""),
  kind: z
    .enum(["morning", "evening", "work-startup", "leaving", "custom"])
    .default("custom"),
});

/** POST /api/routines/draft — AI drafts a resilient routine (Pro). Streamed. */
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
  if (!(await checkBurst(identity, "breakdown", BURST.breakdown))) {
    return json({ error: "rate_limited" }, 429);
  }

  let ratio = 1;
  if (identity.supabase) {
    const tt = await getTimeTruth(identity.supabase, identity.user.id);
    if (tt.enough) ratio = tt.ratio;
  }

  const { when, must, wrong, kind } = parsed.data;
  try {
    return streamGeminiJson({
      system: buildRoutinePrompt(ratio),
      user: `Routine type: ${kind}\nWhen: ${when}\nWhat must happen: ${must}\nWhat always goes wrong: ${wrong}`,
      maxTokens: 1024,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
