import { NextRequest } from "next/server";
import { buildProfilePrompt } from "@/lib/gemini";
import { streamGeminiJson } from "@/lib/geminiStream";
import { getRequestIdentity, checkBurst, BURST } from "@/lib/quota";
import { MIN_SIGNALS, type FocusSignal } from "@/lib/focusProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * POST /api/profile/summarise — AI names what the brain runs on (Pro),
 * streamed, from the user's own signals. The client PATCHes the result onto
 * the profile via /api/profile.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const identity = await getRequestIdentity(req);
  if (!identity.user) return json({ error: "unauthorized" }, 401);
  if (identity.plan !== "pro") return json({ error: "pro_required" }, 402);
  if (!identity.supabase) return json({ error: "unavailable" }, 503);
  if (!(await checkBurst(identity, "aiLight", BURST.aiLight))) {
    return json({ error: "rate_limited" }, 429);
  }

  const { data } = await identity.supabase
    .from("focus_signals")
    .select("pulled_in, title, hour, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  const signals = (data ?? []) as FocusSignal[];
  if (signals.length < MIN_SIGNALS) return json({ error: "not_enough" }, 409);

  const lines = signals
    .filter((s) => s.title)
    .map(
      (s) => `- "${s.title}" — ${s.pulled_in ? "pulled me in" : "had to drag"}`,
    )
    .join("\n");

  try {
    return streamGeminiJson({
      system: buildProfilePrompt(),
      user: `Activities:\n${lines}`,
      maxTokens: 400,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
