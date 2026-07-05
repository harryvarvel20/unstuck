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

const createTaskSchema = z.object({
  input_text: z.string().trim().min(1).max(500),
  steps: z.array(stepSchema).min(1).max(40),
});

/** POST /api/tasks — save a completed breakdown for the signed-in user. */
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

  const parsed = createTaskSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const completed = parsed.data.steps.map(() => false);

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      input_text: parsed.data.input_text,
      steps: parsed.data.steps,
      completed_steps: completed,
    })
    .select("id")
    .single();

  if (error) {
    console.error("task insert failed:", error.message);
    return json({ error: "save_failed" }, 500);
  }

  return json({ id: data.id }, 201);
}

/** GET /api/tasks — list the signed-in user's tasks (most recent first). */
export async function GET(): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data, error } = await supabase
    .from("tasks")
    .select("id, input_text, steps, completed_steps, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("task list failed:", error.message);
    return json({ error: "list_failed" }, 500);
  }

  return json({ tasks: data ?? [] }, 200);
}
