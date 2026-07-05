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

const stepSchema = z.object({
  title: z.string(),
  minutes: z.number(),
  tip: z.string().optional(),
});

const patchSchema = z
  .object({
    completed_steps: z.array(z.boolean()).max(40).optional(),
    steps: z.array(stepSchema).max(40).optional(),
    /** Amnesty: archive (true) or recover (false). Never deletes. */
    archived: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.completed_steps !== undefined ||
      v.steps !== undefined ||
      v.archived !== undefined,
    { message: "nothing to update" },
  );

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/tasks/:id — fetch one task (RLS restricts to the owner). */
export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data, error } = await supabase
    .from("tasks")
    .select("id, input_text, steps, completed_steps, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return json({ error: "fetch_failed" }, 500);
  if (!data) return json({ error: "not_found" }, 404);

  return json({ task: data }, 200);
}

/** PATCH /api/tasks/:id — update which steps are ticked off. */
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
  if (parsed.data.completed_steps !== undefined) {
    update.completed_steps = parsed.data.completed_steps;
  }
  if (parsed.data.steps !== undefined) {
    update.steps = parsed.data.steps;
  }
  if (parsed.data.archived !== undefined) {
    update.archived_at = parsed.data.archived ? new Date().toISOString() : null;
  }

  const { error } = await supabase.from("tasks").update(update).eq("id", id);

  if (error) {
    console.error("task update failed:", error.message);
    return json({ error: "update_failed" }, 500);
  }

  return json({ ok: true }, 200);
}
