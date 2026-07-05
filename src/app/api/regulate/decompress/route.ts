import { NextRequest } from "next/server";
import { z } from "zod";
import {
  buildDecompressPrompt,
  buildDecompressActionPrompt,
} from "@/lib/gemini";
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

const schema = z.object({
  text: z.string().trim().min(1).max(4000),
  action: z.enum(["reflect", "reframe", "repair"]).default("reflect"),
});

/**
 * POST /api/regulate/decompress — one bounded step of the decompress flow.
 * Pro. Reflect first; then a chosen reframe/repair. Crisis rule in the prompt.
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
  if (!identity.user) return json({ error: "unauthorized" }, 401);
  if (identity.plan !== "pro") return json({ error: "pro_required" }, 402);
  if (!(await checkBurst(identity, "aiLight", BURST.aiLight))) {
    return json({ error: "rate_limited" }, 429);
  }

  // Light usage log (heavy use → gentle "talk to a human" nudge). Best-effort.
  if (parsed.data.action === "reflect" && identity.supabase) {
    void identity.supabase
      .from("regulate_log")
      .insert({ user_id: identity.user.id, tool: "decompress" });
  }

  const system =
    parsed.data.action === "reflect"
      ? buildDecompressPrompt()
      : buildDecompressActionPrompt(parsed.data.action);

  try {
    return streamGeminiJson({
      system,
      user: parsed.data.text,
      maxTokens: 400,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
