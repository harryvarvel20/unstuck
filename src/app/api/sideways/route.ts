import { NextRequest } from "next/server";
import { z } from "zod";
import { buildSidewaysPrompt } from "@/lib/gemini";
import { streamGeminiJson } from "@/lib/geminiStream";
import { getRequestIdentity, checkBurst, BURST } from "@/lib/quota";
import {
  consumeAnonQuota,
  consumeUserQuota,
  hashIp,
  getClientIp,
} from "@/lib/rateLimit";
import { getTimeTruth } from "@/lib/timeTruth";

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
  items: z
    .array(
      z.object({
        id: z.string().max(80),
        title: z.string().trim().min(1).max(300),
        minutes: z.number().int().min(1).max(600),
      }),
    )
    .min(1)
    .max(30),
  hoursLeft: z.number().min(0.5).max(16),
});

/**
 * POST /api/sideways — "Day went sideways" triage. Free users spend one
 * daily breakdown credit (it's a generative plan); Pro unlimited.
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
  if (!(await checkBurst(identity, "breakdown", BURST.breakdown))) {
    return json({ error: "rate_limited" }, 429);
  }

  if (identity.plan !== "pro") {
    const quota = identity.user
      ? await consumeUserQuota(identity.user.id)
      : await consumeAnonQuota(hashIp(getClientIp(req.headers)));
    if (!quota.allowed) {
      return json(
        { error: "limit_reached", message: "You've used today's free plans." },
        429,
      );
    }
  }

  let ratio = 1;
  if (identity.user && identity.supabase && identity.plan === "pro") {
    const tt = await getTimeTruth(identity.supabase, identity.user.id);
    if (tt.enough) ratio = tt.ratio;
  }

  try {
    return streamGeminiJson({
      system: buildSidewaysPrompt(parsed.data.hoursLeft, ratio),
      user: `Remaining items:\n${JSON.stringify(parsed.data.items)}`,
      maxTokens: 1536,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
