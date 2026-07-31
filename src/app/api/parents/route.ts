import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * GET /api/parents — Parents-Mode status + plan only. Child data (the child
 * list, reward charts, wins) lives on the parent's device and is never stored
 * on or returned by the server.
 */
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

  return json({
    enabled: Boolean(profile?.parents_mode),
    plan: profile?.plan === "pro" ? "pro" : "free",
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
