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
  /** Tomorrow's head-contents, one item per line. Thought-offloading only. */
  captured: z.array(z.string().trim().min(1).max(300)).max(60).default([]),
  /** Tomorrow's ONE tiny first action. */
  first: z
    .object({
      title: z.string().trim().min(1).max(300),
      minutes: z.number().int().min(1).max(60).default(5),
    })
    .nullish(),
  /** Two lines of "what happened today that you did". */
  winsNote: z.string().trim().max(400).optional(),
});

/**
 * POST /api/winddown — close the day. Stores a wind-down plan dated TOMORROW
 * so the morning landing can hand back the one tiny first action. No AI, no
 * sleep claims — this is thought-offloading. Free for all signed-in users.
 */
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

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const planDate = tomorrow.toISOString().slice(0, 10);

  const { error } = await supabase.from("plans").insert({
    user_id: user.id,
    plan_date: planDate,
    kind: "winddown",
    today: parsed.data.first
      ? [{ title: parsed.data.first.title, minutes: parsed.data.first.minutes }]
      : [],
    captured: parsed.data.captured,
    wins_note: parsed.data.winsNote ?? null,
  });

  if (error) {
    console.error("winddown insert failed:", error.message);
    return json({ error: "save_failed" }, 500);
  }
  return json({ ok: true }, 201);
}
