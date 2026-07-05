import { NextRequest } from "next/server";
import { buildIdeaPrompt } from "@/lib/gemini";
import { streamGeminiJson } from "@/lib/geminiStream";
import { getRequestIdentity, checkBurst, BURST } from "@/lib/quota";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/ideas/:id/develop — AI develops the idea on demand (Pro), streamed.
 * The client persists the parsed card back via PATCH.
 */
export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;

  const identity = await getRequestIdentity(req);
  if (!identity.user) return json({ error: "unauthorized" }, 401);
  if (identity.plan !== "pro") return json({ error: "pro_required" }, 402);
  if (!(await checkBurst(identity, "breakdown", BURST.breakdown))) {
    return json({ error: "rate_limited" }, 429);
  }

  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const { data: idea } = await supabase
    .from("ideas")
    .select("text")
    .eq("id", id)
    .maybeSingle();
  if (!idea?.text) return json({ error: "not_found" }, 404);

  try {
    return streamGeminiJson({
      system: buildIdeaPrompt(),
      user: idea.text,
      maxTokens: 1200,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
