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

const patchSchema = z.object({ outcome: z.enum(["acted", "passed"]) });

/** PATCH /api/impulses/:id — record the decision after the wait. */
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

  const { error } = await supabase
    .from("impulses")
    .update({
      outcome: parsed.data.outcome,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return json({ error: "update_failed" }, 500);
  return json({ ok: true }, 200);
}
