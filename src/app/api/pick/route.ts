import { NextRequest } from "next/server";
import { z } from "zod";
import { choosePick, type PickCandidate } from "@/lib/pick";
import { getRequestIdentity } from "@/lib/quota";
import { getTimeTruth, calibrateMinutes } from "@/lib/timeTruth";
import type { BreakdownStep } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({
  minutes: z.number().int().min(5).max(240),
  /** Client-local hour (0-23) — the server clock may be in another timezone. */
  hour: z.number().int().min(0).max(23),
  exclude: z.array(z.string().max(80)).max(10).default([]),
  /** Anonymous users send their current in-memory steps. */
  localSteps: z
    .array(
      z.object({
        index: z.number().int().min(0).max(50),
        title: z.string().trim().min(1).max(300),
        minutes: z.number().int().min(1).max(120),
        tip: z.string().max(300).optional(),
      }),
    )
    .max(60)
    .default([]),
});

/** POST /api/pick — choose exactly ONE next step. Pure logic, no AI. */
export async function POST(req: NextRequest): Promise<Response> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const identity = await getRequestIdentity(req);
  const candidates: PickCandidate[] = [];

  // Calibration only shapes the choice for Pro (Time Truth is a Pro surface).
  let ratio = 1;
  if (identity.user && identity.supabase && identity.plan === "pro") {
    const tt = await getTimeTruth(identity.supabase, identity.user.id);
    if (tt.enough) ratio = tt.ratio;
  }

  if (identity.user && identity.supabase) {
    const { data: tasks } = await identity.supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(50);

    for (const task of tasks ?? []) {
      // Skip archived tasks when the column exists (migration 0005+).
      if ((task as { archived_at?: string | null }).archived_at) continue;
      const steps = (task.steps ?? []) as BreakdownStep[];
      const done = (task.completed_steps ?? []) as boolean[];
      steps.forEach((step, index) => {
        if (done[index]) return;
        if (!step?.title || typeof step.minutes !== "number") return;
        candidates.push({
          key: `task:${task.id}:${index}`,
          taskId: task.id,
          taskInput: task.input_text ?? null,
          stepIndex: index,
          title: step.title,
          minutes: step.minutes,
          calMinutes: calibrateMinutes(step.minutes, ratio),
          tip: step.tip,
          completedSteps: steps.map((_, i) => done[i] ?? false),
        });
      });
    }
  } else {
    for (const s of parsed.data.localSteps) {
      candidates.push({
        key: `local:${s.index}`,
        taskId: null,
        taskInput: null,
        stepIndex: s.index,
        title: s.title,
        minutes: s.minutes,
        calMinutes: s.minutes,
        tip: s.tip,
      });
    }
  }

  const result = choosePick(
    candidates,
    parsed.data.minutes,
    parsed.data.hour,
    parsed.data.exclude,
  );

  return json(result, 200);
}
