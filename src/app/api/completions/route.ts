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
  taskId: z.string().uuid().nullish(),
  stepIndex: z.number().int().min(0).max(50).nullish(),
  estimatedMinutes: z.number().int().min(1).max(120),
  actualMinutes: z.number().min(0.2).max(600),
  source: z.enum(["focus", "checkoff"]),
});

/** POST /api/completions — record an estimated-vs-actual data point. */
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

  // Plausibility guard: an "actual" wildly outside the estimate's orbit is
  // more likely a left-open tab than a measurement. Keep the data honest.
  const { estimatedMinutes, actualMinutes } = parsed.data;
  const plausible =
    actualMinutes >= Math.min(1, estimatedMinutes * 0.2) &&
    actualMinutes <= estimatedMinutes * 6 + 30;
  if (!plausible) return json({ ok: true, skipped: true }, 200);

  const { error } = await supabase.from("step_completions").insert({
    user_id: user.id,
    task_id: parsed.data.taskId ?? null,
    step_index: parsed.data.stepIndex ?? null,
    estimated_minutes: estimatedMinutes,
    actual_minutes: actualMinutes,
    source: parsed.data.source,
  });

  if (error) {
    console.error("completion insert failed:", error.message);
    return json({ error: "save_failed" }, 500);
  }
  return json({ ok: true }, 201);
}
