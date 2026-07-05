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

const itemSchema = z.object({
  id: z.string().max(80),
  course: z.enum(["appetiser", "entree", "side", "special"]),
  text: z.string().trim().min(1).max(200),
  minutes: z.number().int().min(1).max(240),
  shows: z.number().int().min(0).max(100000).default(0),
  picks: z.number().int().min(0).max(100000).default(0),
});

const saveSchema = z.object({ items: z.array(itemSchema).max(60) });

/** GET /api/dopamenu — the user's menu. */
export async function GET(): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data } = await supabase
    .from("dopamenu")
    .select("items")
    .eq("user_id", user.id)
    .maybeSingle();
  return json({ items: data?.items ?? [] }, 200);
}

/** POST /api/dopamenu — upsert the whole menu (Pro). */
export async function POST(req: NextRequest): Promise<Response> {
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
  if (profile?.plan !== "pro") return json({ error: "pro_required" }, 402);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const parsed = saveSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const { error } = await supabase.from("dopamenu").upsert(
    {
      user_id: user.id,
      items: parsed.data.items,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("dopamenu save failed:", error.message);
    return json({ error: "save_failed" }, 500);
  }
  return json({ ok: true }, 200);
}
