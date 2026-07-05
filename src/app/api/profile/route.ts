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
  focus_profile: z.object({
    runs_on: z.array(z.string().max(40)).max(6),
    summary: z.string().max(400),
  }),
});

/** POST /api/profile — cache the AI focus-profile summary onto the profile. */
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

  const { error } = await supabase
    .from("profiles")
    .update({ focus_profile: parsed.data.focus_profile })
    .eq("id", user.id);
  if (error) return json({ error: "save_failed" }, 500);
  return json({ ok: true }, 200);
}
