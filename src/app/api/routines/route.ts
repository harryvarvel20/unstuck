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
  title: z.string().trim().min(1).max(200),
  minutes: z.number().int().min(1).max(60),
  skippable: z.boolean(),
});

const saveSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z
    .enum(["morning", "evening", "work-startup", "leaving", "custom"])
    .default("custom"),
  steps: z.array(stepSchema).min(1).max(12),
});

/** GET /api/routines — the user's routines. */
export async function GET(): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data, error } = await supabase
    .from("routines")
    .select("id, name, kind, steps")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return json({ error: "list_failed" }, 500);
  return json({ routines: data ?? [] }, 200);
}

/** POST /api/routines — save a routine (Pro). */
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

  const { data, error } = await supabase
    .from("routines")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      kind: parsed.data.kind,
      steps: parsed.data.steps,
    })
    .select("id")
    .single();
  if (error) {
    console.error("routine save failed:", error.message);
    return json({ error: "save_failed" }, 500);
  }
  return json({ id: data.id }, 201);
}
