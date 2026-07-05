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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/social/dms — thread list with the latest line of each. */
export async function GET(): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    const { db, userId } = ctx;

    const { data: threads } = await db
      .from("dm_threads")
      .select("id, user_a, user_b, created_at")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);

    const shaped = [];
    for (const t of threads ?? []) {
      const otherId = t.user_a === userId ? t.user_b : t.user_a;
      if (await isBlocked(db, userId, otherId)) continue;
      const { data: last } = await db
        .from("dm_messages")
        .select("content, sender_id, created_at")
        .eq("thread_id", t.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      shaped.push({
        id: t.id,
        otherId,
        last: last
          ? {
              content: last.content.slice(0, 80),
              mine: last.sender_id === userId,
              at: last.created_at,
            }
          : null,
      });
    }
    const cards = await authorCards(
      db,
      shaped.map((s) => s.otherId),
    );
    shaped.sort((a, b) => ((a.last?.at ?? "0") < (b.last?.at ?? "0") ? 1 : -1));
    return json({
      threads: shaped.map((s) => ({
        id: s.id,
        name: cards.get(s.otherId)?.name ?? "someone",
        last: s.last,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}

const createSchema = z.object({ friendId: z.string().uuid() });

/** POST /api/social/dms — open (or find) a 1:1 thread with a friend. */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const { db, userId } = ctx;
    const friendId = parsed.data.friendId;

    // Friends only, both allowing DMs, no block either way.
    if (!(await areFriends(db, userId, friendId))) {
      return json({ error: "not_found" }, 404);
    }
    if (await isBlocked(db, userId, friendId)) {
      return json({ error: "not_found" }, 404);
    }
    const { data: theirProfile } = await db
      .from("social_profiles")
      .select("allow_dms")
      .eq("user_id", friendId)
      .maybeSingle();
    if (theirProfile && !theirProfile.allow_dms) {
      return json({ error: "dms_off" }, 403);
    }

    const [a, b] = orderPair(userId, friendId);
    const { data: existing } = await db
      .from("dm_threads")
      .select("id")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    if (existing) return json({ ok: true, threadId: existing.id });

    const { data: created, error } = await db
      .from("dm_threads")
      .insert({ user_a: a, user_b: b })
      .select("id")
      .maybeSingle();
    if (error || !created) return json({ error: "failed" }, 500);
    return json({ ok: true, threadId: created.id });
  } catch (err) {
    return jsonError(err);
  }
}
