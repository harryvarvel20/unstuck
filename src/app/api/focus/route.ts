import { NextRequest } from "next/server";
import { z } from "zod";
import { getRequestIdentity, consumeFeature, LIMITS } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const startSchema = z.object({
  taskId: z.string().uuid().nullish(),
  stepIndex: z.number().int().min(0).max(50).nullish(),
  stepTitle: z.string().trim().min(1).max(300),
  plannedMinutes: z.union([z.literal(10), z.literal(25), z.literal(50)]),
  estimatedMinutes: z.number().int().min(1).max(60).nullish(),
});

/**
 * POST /api/focus — start a focus session.
 * Free: 1/day (per user when signed in, per hashed IP otherwise). Pro: unlimited.
 * Signed-in sessions are persisted; anonymous ones just consume the counter.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const parsed = startSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const identity = await getRequestIdentity(req);
  const quota = await consumeFeature(identity, "focus", LIMITS.focusPerDay);
  if (!quota.allowed) {
    return json(
      {
        error: "limit_reached",
        message: "You've used today's focus session.",
      },
      429,
    );
  }

  // Persist for signed-in users (feeds Time Truth + weekly wins).
  let sessionId: string | null = null;
  if (identity.user && identity.supabase) {
    const { data, error } = await identity.supabase
      .from("focus_sessions")
      .insert({
        user_id: identity.user.id,
        task_id: parsed.data.taskId ?? null,
        step_index: parsed.data.stepIndex ?? null,
        step_title: parsed.data.stepTitle,
        planned_minutes: parsed.data.plannedMinutes,
        estimated_minutes: parsed.data.estimatedMinutes ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("focus session insert failed:", error.message);
      // Session still runs client-side; persistence is best-effort.
    } else {
      sessionId = data.id;
    }
  }

  return json({ id: sessionId, enforced: quota.enforced }, 201);
}
