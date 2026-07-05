import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({
  source: z.enum(["focus", "task"]).default("focus"),
  pulled_in: z.boolean(),
  title: z.string().trim().max(300).nullish(),
  hour: z.number().int().min(0).max(23),
});

/** POST /api/signals — log a "did that pull you in?" answer. */
export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const { error } = await supabase.from("focus_signals").insert({
    user_id: user.id,
    source: parsed.data.source,
    pulled_in: parsed.data.pulled_in,
    title: parsed.data.title ?? null,
    hour: parsed.data.hour,
  });
  if (error) return json({ error: "save_failed" }, 500);
  return json({ ok: true }, 201);
}
