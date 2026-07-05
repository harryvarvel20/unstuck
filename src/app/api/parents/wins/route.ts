import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { childSafetyConcern, CHILD_SAFETY_SIGNPOST } from "@/lib/safety";
import { checkParentsBurst } from "@/lib/socialServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function user(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
) {
  if (!supabase) return null;
  const {
    data: { user: u },
  } = await supabase.auth.getUser();
  return u;
}

/** GET /api/parents/wins — the parent's "wins about my kid" log. */
export async function GET(): Promise<Response> {
  const supabase = await createSupabaseServer();
  const u = await user(supabase);
  if (!u) return json({ error: "unauthorized" }, 401);
  const { data } = await supabase!
    .from("kid_wins")
    .select("id, child_id, text, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  return json({ wins: data ?? [] });
}

const addSchema = z.object({
  childId: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(500),
});

/** POST — log a win (runs the safeguarding screen on the free text). */
export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  const u = await user(supabase);
  if (!u) return json({ error: "unauthorized" }, 401);
  if (!(await checkParentsBurst(u.id)))
    return json({ error: "rate_limited" }, 429);
  const parsed = addSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  if (childSafetyConcern(parsed.data.text)) {
    return json({ childSafety: true, message: CHILD_SAFETY_SIGNPOST });
  }
  const { data, error } = await supabase!
    .from("kid_wins")
    .insert({
      parent_id: u.id,
      child_id: parsed.data.childId ?? null,
      text: parsed.data.text,
    })
    .select("id, child_id, text, created_at")
    .maybeSingle();
  if (error || !data) return json({ error: "failed" }, 500);
  return json({ ok: true, win: data });
}

const delSchema = z.object({ id: z.string().uuid() });

/** DELETE — remove a win. */
export async function DELETE(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  const u = await user(supabase);
  if (!u) return json({ error: "unauthorized" }, 401);
  const parsed = delSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  await supabase!.from("kid_wins").delete().eq("id", parsed.data.id);
  return json({ ok: true });
}
