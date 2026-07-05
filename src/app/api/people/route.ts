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

/** GET /api/people — the people who matter + the opt-in goal. */
export async function GET(): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const [{ data: people }, { data: profile }] = await Promise.all([
    supabase
      .from("people")
      .select("id, name, relationship, cadence_days, last_contacted")
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("profiles")
      .select("connection_goal")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  return json(
    { people: people ?? [], goal: profile?.connection_goal ?? null },
    200,
  );
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  relationship: z.string().trim().max(80).optional().default(""),
  cadence_days: z.number().int().min(1).max(365).default(14),
});

/** POST /api/people — add someone (Pro). */
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
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const { data, error } = await supabase
    .from("people")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      relationship: parsed.data.relationship || null,
      cadence_days: parsed.data.cadence_days,
    })
    .select("id, name, relationship, cadence_days, last_contacted")
    .single();
  if (error) return json({ error: "save_failed" }, 500);
  return json({ person: data }, 201);
}
