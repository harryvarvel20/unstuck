import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Child } from "@/lib/parents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface ChildRow {
  id: string;
  name: string | null;
  age_band: Child["ageBand"];
  hardest: string | null;
  created_at: string;
}

function shape(rows: ChildRow[] | null): Child[] {
  return (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    ageBand: r.age_band,
    hardest: r.hardest,
    createdAt: r.created_at,
  }));
}

/** GET /api/parents — Parents-Mode status, plan, and the parent's children. */
export async function GET(): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, parents_mode")
    .eq("id", user.id)
    .maybeSingle();

  const { data: children } = await supabase
    .from("children")
    .select("id, name, age_band, hardest, created_at")
    .order("created_at", { ascending: true });

  return json({
    enabled: Boolean(profile?.parents_mode),
    plan: profile?.plan === "pro" ? "pro" : "free",
    children: shape(children as ChildRow[] | null),
  });
}

const patchSchema = z.object({ enabled: z.boolean() });

/** PATCH /api/parents — turn Parents Mode on/off. Pro-gated (server-side). */
export async function PATCH(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "invalid" }, 400);

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.plan !== "pro") return json({ error: "pro_required" }, 402);

  const { error } = await supabase
    .from("profiles")
    .update({ parents_mode: parsed.data.enabled })
    .eq("id", user.id);
  if (error) return json({ error: "failed" }, 500);

  return json({ ok: true, enabled: parsed.data.enabled });
}
