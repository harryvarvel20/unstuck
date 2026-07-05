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

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  reached_out: z.boolean().optional(),
  cadence_days: z.number().int().min(1).max(365).optional(),
});

/** PATCH /api/people/:id — "I reached out" (updates last_contacted) or cadence. */
export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
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
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const update: Record<string, unknown> = {};
  if (parsed.data.reached_out) update.last_contacted = new Date().toISOString();
  if (parsed.data.cadence_days) update.cadence_days = parsed.data.cadence_days;

  const { error } = await supabase.from("people").update(update).eq("id", id);
  if (error) return json({ error: "update_failed" }, 500);
  return json({ ok: true }, 200);
}

/** DELETE /api/people/:id */
export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) return json({ error: "delete_failed" }, 500);
  return json({ ok: true }, 200);
}
