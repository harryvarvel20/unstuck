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
  today: z
    .array(
      z.object({
        id: z.string().max(80).optional(),
        title: z.string().trim().min(1).max(300),
        minutes: z.number().int().min(1).max(240),
        taskId: z.string().uuid().nullish(),
        stepIndex: z.number().int().min(0).max(50).nullish(),
      }),
    )
    .max(10),
  captured: z.array(z.string().trim().min(1).max(300)).max(60),
});

/** POST /api/plans — persist a morning plan (today + captured list). */
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

  const { error } = await supabase.from("plans").insert({
    user_id: user.id,
    today: parsed.data.today,
    captured: parsed.data.captured,
  });
  if (error) {
    console.error("plan insert failed:", error.message);
    return json({ error: "save_failed" }, 500);
  }
  return json({ ok: true }, 201);
}
