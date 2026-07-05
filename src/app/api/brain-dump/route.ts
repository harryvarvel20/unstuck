import { NextRequest } from "next/server";
import { z } from "zod";
import { buildBrainDumpPrompt } from "@/lib/gemini";
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
  text: z.string().trim().min(1).max(2000),
  availableHours: z.number().min(0.5).max(16),
});

/** POST /api/brain-dump — morning chaos → realistic today plan. Pro only. */
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
  if (identity.plan !== "pro") {
    return json({ error: "pro_required" }, 402);
  }
  if (!(await checkBurst(identity, "breakdown", BURST.breakdown))) {
    return json({ error: "rate_limited" }, 429);
  }

  let ratio = 1;
  if (identity.supabase) {
    const tt = await getTimeTruth(identity.supabase, identity.user.id);
    if (tt.enough) ratio = tt.ratio;
  }

  try {
    return streamGeminiJson({
      system: buildBrainDumpPrompt(parsed.data.availableHours, ratio),
      user: parsed.data.text,
      maxTokens: 1536,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
