import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { childSafetyConcern, CHILD_SAFETY_SIGNPOST } from "@/lib/safety";
import { checkParentsBurst } from "@/lib/socialServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function requireProUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
): Promise<{ id: string } | Response> {
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
  return { id: user.id };
}

const addSchema = z.object({
  name: z.string().trim().max(40).optional(),
  ageBand: z.enum(["4-7", "8-12", "13-17"]),
  hardest: z.string().trim().max(500).optional(),
});

/** POST /api/parents/children — add a child (minimal data, Pro-gated). */
export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  const gate = await requireProUser(supabase);
  if (gate instanceof Response) return gate;
  if (!(await checkParentsBurst(gate.id))) {
    return json({ error: "rate_limited" }, 429);
  }

  const parsed = addSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const { name, ageBand, hardest } = parsed.data;

  // Safeguarding: route to help instead of storing/planning on a concern.
  if (hardest && childSafetyConcern(hardest)) {
    return json({ childSafety: true, message: CHILD_SAFETY_SIGNPOST });
  }

  const { data, error } = await supabase!
    .from("children")
    .insert({
      parent_id: gate.id,
      name: name || null,
      age_band: ageBand,
      hardest: hardest || null,
    })
    .select("id, name, age_band, hardest, created_at")
    .maybeSingle();
  if (error || !data) return json({ error: "failed" }, 500);

  return json({
    ok: true,
    child: {
      id: data.id,
      name: data.name,
      ageBand: data.age_band,
      hardest: data.hardest,
      createdAt: data.created_at,
    },
  });
}

const deleteSchema = z.object({ id: z.string().uuid() });

/** DELETE /api/parents/children — remove a child (one tap; RLS-scoped). */
export async function DELETE(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "invalid" }, 400);

  // RLS already confines this to the caller's own children; the explicit
  // parent_id filter is defence-in-depth in case a future edit swaps in the
  // service-role client here (which would silently bypass RLS).
  await supabase
    .from("children")
    .delete()
    .eq("id", parsed.data.id)
    .eq("parent_id", user.id);
  return json({ ok: true });
}
