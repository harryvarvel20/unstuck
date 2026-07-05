import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getTimeTruth } from "@/lib/timeTruth";
import type { TimelineItem } from "@/lib/timeline";
import type { BreakdownStep } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * GET /api/today — the day's timeline items. Today's saved morning plan wins;
 * otherwise items are derived from open tasks (next steps first). Includes
 * the Time-Truth ratio so the client schedules at their real pace.
 */
export async function GET(): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  const isPro = profile?.plan === "pro";
  if (!isPro) return json({ error: "pro_required" }, 402);

  const tt = await getTimeTruth(supabase, user.id);
  const ratio = tt.enough ? tt.ratio : 1;

  // Saved plan for today?
  const { data: plan } = await supabase
    .from("plans")
    .select("id, today")
    .eq("kind", "morning")
    .eq("plan_date", todayDate())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (plan && Array.isArray(plan.today) && plan.today.length > 0) {
    return json(
      { items: plan.today as TimelineItem[], ratio, planId: plan.id },
      200,
    );
  }

  // Derive from open tasks: the next 2 unchecked steps of each, max 8 items.
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  const items: TimelineItem[] = [];
  for (const task of tasks ?? []) {
    if ((task as { archived_at?: string | null }).archived_at) continue;
    const steps = (task.steps ?? []) as BreakdownStep[];
    const done = (task.completed_steps ?? []) as boolean[];
    let taken = 0;
    for (let i = 0; i < steps.length && taken < 2; i++) {
      if (done[i]) continue;
      const step = steps[i];
      if (!step?.title) continue;
      items.push({
        id: `t-${task.id}-${i}`,
        title: step.title,
        minutes: typeof step.minutes === "number" ? step.minutes : 5,
        taskId: task.id,
        stepIndex: i,
      });
      taken++;
      if (items.length >= 8) break;
    }
    if (items.length >= 8) break;
  }

  return json({ items, ratio, planId: null }, 200);
}

const itemSchema = z.object({
  id: z.string().max(80),
  title: z.string().trim().min(1).max(300),
  minutes: z.number().int().min(1).max(240),
  deadline: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .nullish(),
  must: z.boolean().optional(),
  done: z.boolean().optional(),
  taskId: z.string().uuid().nullish(),
  stepIndex: z.number().int().min(0).max(50).nullish(),
});

const saveSchema = z.object({
  items: z.array(itemSchema).max(30),
  planId: z.string().uuid().nullish(),
});

/** POST /api/today — persist the day's items (deadlines, dones, reflows). */
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
  const parsed = saveSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  if (parsed.data.planId) {
    const { error } = await supabase
      .from("plans")
      .update({ today: parsed.data.items })
      .eq("id", parsed.data.planId);
    if (error) return json({ error: "save_failed" }, 500);
    return json({ planId: parsed.data.planId }, 200);
  }

  const { data, error } = await supabase
    .from("plans")
    .insert({
      user_id: user.id,
      plan_date: todayDate(),
      kind: "morning",
      today: parsed.data.items,
      captured: [],
    })
    .select("id")
    .single();
  if (error) {
    console.error("today plan save failed:", error.message);
    return json({ error: "save_failed" }, 500);
  }
  return json({ planId: data.id }, 201);
}
