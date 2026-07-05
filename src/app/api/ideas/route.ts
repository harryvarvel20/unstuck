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

/** GET /api/ideas — the vault. */
export async function GET(): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data } = await supabase
    .from("ideas")
    .select("id, text, developed, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return json({ ideas: data ?? [] }, 200);
}

const createSchema = z.object({ text: z.string().trim().min(1).max(2000) });

/** POST /api/ideas — capture a raw idea in two taps. */
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

  const { data, error } = await supabase
    .from("ideas")
    .insert({ user_id: user.id, text: parsed.data.text })
    .select("id, text, developed, status, created_at")
    .single();
  if (error) {
    console.error("idea insert failed:", error.message);
    return json({ error: "save_failed" }, 500);
  }
  return json({ idea: data }, 201);
}
