import { NextRequest } from "next/server";
import { z } from "zod";
import { buildSpiralPrompt } from "@/lib/gemini";
import { streamGeminiJson } from "@/lib/geminiStream";
import { getRequestIdentity, checkBurst, BURST } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({ text: z.string().trim().min(1).max(3000) });

/** POST /api/regulate/spiral — RSD message-spiral defuser (Pro). Streamed. */
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

  if (identity.supabase) {
    void identity.supabase
      .from("regulate_log")
      .insert({ user_id: identity.user.id, tool: "spiral" });
  }

  try {
    return streamGeminiJson({
      system: buildSpiralPrompt(),
      user: parsed.data.text,
      maxTokens: 600,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
