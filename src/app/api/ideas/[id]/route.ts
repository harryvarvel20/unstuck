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
  developed: z.record(z.string(), z.unknown()).nullish(),
  status: z.enum(["seed", "developing", "active", "done"]).optional(),
});

/** PATCH /api/ideas/:id — store the developed card or change status. */
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

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.developed !== undefined)
    update.developed = parsed.data.developed;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;

  const { error } = await supabase.from("ideas").update(update).eq("id", id);
  if (error) return json({ error: "update_failed" }, 500);
  return json({ ok: true }, 200);
}

/** DELETE /api/ideas/:id */
export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { error } = await supabase.from("ideas").delete().eq("id", id);
  if (error) return json({ error: "delete_failed" }, 500);
  return json({ ok: true }, 200);
}
