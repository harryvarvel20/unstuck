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

const finishSchema = z.object({
  completed: z.boolean().optional(),
  struggled: z.boolean().optional(),
  actualMinutes: z.number().min(0).max(600).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/focus/:id — record how the session ended (owner-only via RLS). */
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
  const parsed = finishSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const update: Record<string, unknown> = {
    ended_at: new Date().toISOString(),
  };
  if (parsed.data.completed !== undefined)
    update.completed = parsed.data.completed;
  if (parsed.data.struggled !== undefined)
    update.struggled = parsed.data.struggled;
  if (parsed.data.actualMinutes !== undefined) {
    update.actual_minutes = parsed.data.actualMinutes;
  }

  const { data: session, error } = await supabase
    .from("focus_sessions")
    .update(update)
    .eq("id", id)
    .select("task_id, step_index, estimated_minutes")
    .maybeSingle();

  if (error) {
    console.error("focus session update failed:", error.message);
    return json({ error: "update_failed" }, 500);
  }

  // Time-Truth data point: a completed session with a known estimate gives us
  // a clean estimated-vs-actual pair. Best-effort; never blocks the response.
  if (
    session &&
    parsed.data.completed === true &&
    typeof parsed.data.actualMinutes === "number" &&
    parsed.data.actualMinutes > 0.2 &&
    typeof session.estimated_minutes === "number" &&
    session.estimated_minutes > 0
  ) {
    const { error: cErr } = await supabase.from("step_completions").insert({
      user_id: user.id,
      task_id: session.task_id,
      step_index: session.step_index,
      estimated_minutes: session.estimated_minutes,
      actual_minutes: parsed.data.actualMinutes,
      source: "focus",
    });
    if (cErr) console.error("completion from focus failed:", cErr.message);
  }

  return json({ ok: true }, 200);
}
