import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  requirePro,
  areFriends,
  isBlocked,
  orderPair,
  authorCards,
  checkSocialBurst,
  jsonError,
  json,
} from "@/lib/socialServer";
import { containsCrisisLanguage, CRISIS_SIGNPOST } from "@/lib/safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Accountability buddy — ONE gentle pair, check-ins are "did my one thing",
 * responses are warm one-liners. No streaks, no scores, no guilt mechanics:
 * a missed check-in simply says nothing.
 */

/** GET /api/social/buddy — my pair (if any) + recent check-ins. */
export async function GET(): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    const { db, userId } = ctx;

    const { data: pair } = await db
      .from("buddies")
      .select("id, user_a, user_b, requested_by, status")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .limit(1)
      .maybeSingle();
    if (!pair) return json({ pair: null });

    const otherId = pair.user_a === userId ? pair.user_b : pair.user_a;
    const cards = await authorCards(db, [otherId]);

    const { data: checkins } = await db
      .from("buddy_checkins")
      .select("id, user_id, note, response, created_at")
      .eq("pair_id", pair.id)
      .order("created_at", { ascending: false })
      .limit(14);

    return json({
      pair: {
        id: pair.id,
        status: pair.status,
        awaitingMe: pair.status === "pending" && pair.requested_by !== userId,
        buddyName: cards.get(otherId)?.name ?? "your buddy",
        buddyId: otherId,
      },
      checkins: (checkins ?? []).map((c) => ({
        id: c.id,
        mine: c.user_id === userId,
        note: c.note,
        response: c.response,
        at: c.created_at,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}

const requestSchema = z.object({ friendId: z.string().uuid() });
const checkinSchema = z.object({ note: z.string().trim().min(1).max(240) });
const respondSchema = z.object({
  checkinId: z.string().uuid(),
  response: z.string().trim().min(1).max(160),
});

/** POST — request a buddy, accept, check in, or respond to a check-in. */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const body = await req.json().catch(() => ({}));
    const { db, userId } = ctx;

    if (body.action === "accept") {
      const { data: pair } = await db
        .from("buddies")
        .select("id, requested_by, user_a, user_b")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .eq("status", "pending")
        .maybeSingle();
      if (!pair || pair.requested_by === userId) {
        return json({ error: "not_found" }, 404);
      }
      await db.from("buddies").update({ status: "active" }).eq("id", pair.id);
      return json({ ok: true });
    }

    const reqParse = requestSchema.safeParse(body);
    if (reqParse.success && !body.note && !body.checkinId) {
      const friendId = reqParse.data.friendId;
      if (
        !(await areFriends(db, userId, friendId)) ||
        (await isBlocked(db, userId, friendId))
      ) {
        return json({ error: "not_found" }, 404);
      }
      // One pair each, both sides.
      const { data: mine } = await db
        .from("buddies")
        .select("id")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .limit(1);
      const { data: theirs } = await db
        .from("buddies")
        .select("id")
        .or(`user_a.eq.${friendId},user_b.eq.${friendId}`)
        .limit(1);
      if ((mine && mine.length > 0) || (theirs && theirs.length > 0)) {
        return json({ error: "taken" }, 409);
      }
      const [a, b] = orderPair(userId, friendId);
      const { error } = await db
        .from("buddies")
        .insert({ user_a: a, user_b: b, requested_by: userId });
      if (error) return json({ error: "failed" }, 500);
      return json({ ok: true });
    }

    const checkin = checkinSchema.safeParse(body);
    if (checkin.success && !body.checkinId) {
      if (containsCrisisLanguage(checkin.data.note)) {
        return json({ crisis: true, message: CRISIS_SIGNPOST });
      }
      const { data: pair } = await db
        .from("buddies")
        .select("id")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .eq("status", "active")
        .maybeSingle();
      if (!pair) return json({ error: "not_found" }, 404);
      await db
        .from("buddy_checkins")
        .insert({ pair_id: pair.id, user_id: userId, note: checkin.data.note });
      return json({ ok: true });
    }

    const respond = respondSchema.safeParse(body);
    if (respond.success) {
      const { data: c } = await db
        .from("buddy_checkins")
        .select("id, pair_id, user_id")
        .eq("id", respond.data.checkinId)
        .maybeSingle();
      if (!c || c.user_id === userId) return json({ error: "not_found" }, 404);
      const { data: pair } = await db
        .from("buddies")
        .select("user_a, user_b")
        .eq("id", c.pair_id)
        .maybeSingle();
      if (!pair || (pair.user_a !== userId && pair.user_b !== userId)) {
        return json({ error: "not_found" }, 404);
      }
      await db
        .from("buddy_checkins")
        .update({ response: respond.data.response })
        .eq("id", c.id);
      return json({ ok: true });
    }

    return json({ error: "invalid" }, 400);
  } catch (err) {
    return jsonError(err);
  }
}

/** DELETE — unpair. Silent; the other side just sees no pair anymore. */
export async function DELETE(): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    await ctx.db
      .from("buddies")
      .delete()
      .or(`user_a.eq.${ctx.userId},user_b.eq.${ctx.userId}`);
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
