import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { checkParentsBurst } from "@/lib/socialServer";

/**
 * Security X1 fix: kid_rewards.child_id is the primary key and RLS scopes
 * rows by parent_id, but this route never explicitly checked that the
 * childId in the request actually belongs to the caller before upserting —
 * relying entirely on how Postgres RLS interacts with ON CONFLICT DO UPDATE,
 * which is a subtler guarantee than an explicit check. Verify ownership via
 * the (RLS-scoped) children table before touching kid_rewards, in every
 * handler, so this doesn't depend on that edge case at all.
 */
async function ownsChild(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServer>>>,
  childId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("children")
    .select("id")
    .eq("id", childId)
    .maybeSingle();
  return Boolean(data);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function proUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
) {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.plan === "pro" ? user : null;
}

/** GET /api/parents/rewards?childId= — the reward-chart config + token count. */
export async function GET(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  const user = await proUser(supabase);
  if (!user) return json({ error: "unauthorized" }, 401);
  const childId = req.nextUrl.searchParams.get("childId") ?? "";
  if (!(await ownsChild(supabase!, childId))) {
    return json({ error: "not_found" }, 404);
  }
  const { data } = await supabase!
    .from("kid_rewards")
    .select("behaviours, rewards, tokens")
    .eq("child_id", childId)
    .maybeSingle();
  return json({
    behaviours: data?.behaviours ?? [],
    rewards: data?.rewards ?? [],
    tokens: data?.tokens ?? 0,
  });
}

const putSchema = z.object({
  childId: z.string().uuid(),
  behaviours: z.array(z.string().trim().min(1).max(80)).max(3),
  rewards: z.array(z.string().trim().min(1).max(80)).max(8),
});

/** PUT — set the target behaviours (max 3) and rewards menu. */
export async function PUT(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  const user = await proUser(supabase);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!(await checkParentsBurst(user.id))) {
    return json({ error: "rate_limited" }, 429);
  }
  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  if (!(await ownsChild(supabase!, parsed.data.childId))) {
    return json({ error: "not_found" }, 404);
  }
  const { error } = await supabase!.from("kid_rewards").upsert(
    {
      child_id: parsed.data.childId,
      parent_id: user.id,
      behaviours: parsed.data.behaviours,
      rewards: parsed.data.rewards,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "child_id" },
  );
  if (error) return json({ error: "failed" }, 500);
  return json({ ok: true });
}

const earnSchema = z.object({ childId: z.string().uuid() });

/** POST — earn one token (earning only; never subtracts). */
export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  const user = await proUser(supabase);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!(await checkParentsBurst(user.id))) {
    return json({ error: "rate_limited" }, 429);
  }
  const parsed = earnSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  if (!(await ownsChild(supabase!, parsed.data.childId))) {
    return json({ error: "not_found" }, 404);
  }

  const { data: row } = await supabase!
    .from("kid_rewards")
    .select("tokens")
    .eq("child_id", parsed.data.childId)
    .maybeSingle();
  const tokens = (row?.tokens ?? 0) + 1;
  const { error } = await supabase!.from("kid_rewards").upsert(
    {
      child_id: parsed.data.childId,
      parent_id: user.id,
      tokens,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "child_id" },
  );
  if (error) return json({ error: "failed" }, 500);
  return json({ ok: true, tokens });
}
