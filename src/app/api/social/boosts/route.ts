import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  requirePro,
  areFriends,
  isBlocked,
  authorCards,
  checkSocialBurst,
  jsonError,
  json,
} from "@/lib/socialServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/social/boosts — received boosts, warmest-first (unseen on top). */
export async function GET(): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    const { db, userId } = ctx;

    const { data: boosts } = await db
      .from("boosts")
      .select("id, from_user, message, seen, created_at")
      .eq("to_user", userId)
      .order("seen", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(20);
    const cards = await authorCards(
      db,
      (boosts ?? []).map((b) => b.from_user),
    );

    return json({
      boosts: (boosts ?? []).map((b) => ({
        id: b.id,
        from: cards.get(b.from_user)?.name ?? "a friend",
        message: b.message,
        seen: b.seen,
        at: b.created_at,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}

const sendSchema = z.object({
  toUserId: z.string().uuid(),
  message: z.string().trim().min(1).max(200),
});

/** POST /api/social/boosts — a private warm nudge to a friend. Never public. */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const parsed = sendSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const { db, userId } = ctx;
    const { toUserId, message } = parsed.data;

    if (
      !(await areFriends(db, userId, toUserId)) ||
      (await isBlocked(db, userId, toUserId))
    ) {
      return json({ error: "not_found" }, 404);
    }

    // Gentle flood guard: max 5 boosts to the same friend per day.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("boosts")
      .select("id", { count: "exact", head: true })
      .eq("from_user", userId)
      .eq("to_user", toUserId)
      .gte("created_at", dayAgo);
    if ((count ?? 0) >= 5) return json({ error: "slow_down" }, 429);

    const { error } = await db
      .from("boosts")
      .insert({ from_user: userId, to_user: toUserId, message });
    if (error) return json({ error: "failed" }, 500);
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

/** PATCH /api/social/boosts — mark all mine as seen. */
export async function PATCH(): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    await ctx.db
      .from("boosts")
      .update({ seen: true })
      .eq("to_user", ctx.userId)
      .eq("seen", false);
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
