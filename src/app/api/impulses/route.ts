import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { waitMs, type ImpulseCategory } from "@/lib/impulses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** GET /api/impulses — the log (for the timer + monthly insight). */
export async function GET(): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data } = await supabase
    .from("impulses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return json({ impulses: data ?? [] }, 200);
}

const createSchema = z.object({
  what: z.string().trim().min(1).max(300),
  category: z.enum(["buy", "say", "commit", "quit"]),
  amount: z.number().min(0).max(1_000_000).nullish(),
});

/** POST /api/impulses — log an impulse and start the pause. */
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
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const cat = parsed.data.category as ImpulseCategory;
  const until = new Date(
    Date.now() + waitMs(cat, parsed.data.amount ?? null),
  ).toISOString();

  const { data, error } = await supabase
    .from("impulses")
    .insert({
      user_id: user.id,
      what: parsed.data.what,
      category: cat,
      amount: parsed.data.amount ?? null,
      wait_until: until,
    })
    .select("*")
    .single();
  if (error) {
    console.error("impulse insert failed:", error.message);
    return json({ error: "save_failed" }, 500);
  }
  return json({ impulse: data }, 201);
}
