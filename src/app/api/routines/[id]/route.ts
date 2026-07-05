import { NextRequest } from "next/server";
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

/** DELETE /api/routines/:id — remove a routine (owner-only via RLS). */
export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { error } = await supabase.from("routines").delete().eq("id", id);
  if (error) return json({ error: "delete_failed" }, 500);
  return json({ ok: true }, 200);
}
