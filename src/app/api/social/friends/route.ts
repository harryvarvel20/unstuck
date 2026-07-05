import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  requirePro,
  orderPair,
  isBlocked,
  authorCards,
  checkSocialBurst,
  jsonError,
  json,
} from "@/lib/socialServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/social/friends — accepted friends (+their status when shared),
 * incoming and outgoing pending requests. No counts-as-scores anywhere.
 */
export async function GET(): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    const { db, userId } = ctx;

    const { data: rows } = await db
      .from("friendships")
      .select(
        "id, user_a, user_b, requested_by, status, muted_by_a, muted_by_b",
      )
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);

    const others = (rows ?? []).map((f) =>
      f.user_a === userId ? f.user_b : f.user_a,
    );
    const cards = await authorCards(db, others);

    // Friends' shared struggle statuses (audience=friends only).
    const accepted = (rows ?? []).filter((f) => f.status === "accepted");
    const acceptedIds = accepted.map((f) =>
      f.user_a === userId ? f.user_b : f.user_a,
    );
    const statusMap = new Map<string, string>();
    if (acceptedIds.length > 0) {
      const { data: sts } = await db
        .from("social_statuses")
        .select("user_id, kind, audience, set_at")
        .in("user_id", acceptedIds)
        .eq("audience", "friends")
        .not("kind", "is", null);
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      for (const s of sts ?? []) {
        if (s.set_at && new Date(s.set_at).getTime() > dayAgo && s.kind) {
          statusMap.set(s.user_id, s.kind);
        }
      }
    }

    const shape = (f: NonNullable<typeof rows>[number]) => {
      const otherId = f.user_a === userId ? f.user_b : f.user_a;
      const iAmA = f.user_a === userId;
      return {
        id: f.id,
        friendId: otherId,
        handle: cards.get(otherId)?.handle ?? "someone",
        name: cards.get(otherId)?.name ?? "someone",
        mutedByMe: iAmA ? f.muted_by_a : f.muted_by_b,
        status: statusMap.get(otherId) ?? null,
      };
    };

    return json({
      friends: accepted.map(shape),
      requestsIn: (rows ?? [])
        .filter((f) => f.status === "pending" && f.requested_by !== userId)
        .map(shape),
      requestsOut: (rows ?? [])
        .filter((f) => f.status === "pending" && f.requested_by === userId)
        .map(shape),
      myHandle: ctx.profile.handle,
    });
  } catch (err) {
    return jsonError(err);
  }
}

const addSchema = z.object({ handle: z.string().trim().min(3).max(60) });

/** POST /api/social/friends — send a request by handle (mutual accept only). */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const parsed = addSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);

    const { db, userId } = ctx;
    const { data: target } = await db
      .from("social_profiles")
      .select("user_id, handle")
      .eq("handle", parsed.data.handle.toLowerCase())
      .maybeSingle();

    // Same soft answer whether missing or blocked — no probing.
    if (!target || target.user_id === userId) {
      return json({ error: "not_found" }, 404);
    }
    if (await isBlocked(db, userId, target.user_id)) {
      return json({ error: "not_found" }, 404);
    }

    const [a, b] = orderPair(userId, target.user_id);
    const { data: existing } = await db
      .from("friendships")
      .select("id, status, requested_by")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();

    if (existing) {
      // They already asked us → accept instead of duplicating.
      if (existing.status === "pending" && existing.requested_by !== userId) {
        await db
          .from("friendships")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", existing.id);
        return json({ ok: true, accepted: true });
      }
      return json({ ok: true, already: true });
    }

    const { error } = await db.from("friendships").insert({
      user_a: a,
      user_b: b,
      requested_by: userId,
    });
    if (error) return json({ error: "failed" }, 500);
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["accept", "decline", "mute", "unmute"]),
});

/** PATCH /api/social/friends — accept/decline a request, mute/unmute a friend. */
export async function PATCH(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const { db, userId } = ctx;
    const { id, action } = parsed.data;

    const { data: f } = await db
      .from("friendships")
      .select("id, user_a, user_b, requested_by, status")
      .eq("id", id)
      .maybeSingle();
    if (!f || (f.user_a !== userId && f.user_b !== userId)) {
      return json({ error: "not_found" }, 404);
    }

    if (action === "accept") {
      if (f.status !== "pending" || f.requested_by === userId) {
        return json({ error: "invalid" }, 400);
      }
      await db
        .from("friendships")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", id);
      return json({ ok: true });
    }
    if (action === "decline") {
      // Declining is as silent as unfriending — the row just goes away.
      await db.from("friendships").delete().eq("id", id);
      return json({ ok: true });
    }
    const col = f.user_a === userId ? "muted_by_a" : "muted_by_b";
    await db
      .from("friendships")
      .update({ [col]: action === "mute" })
      .eq("id", id);
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

const deleteSchema = z.object({ id: z.string().uuid() });

/** DELETE /api/social/friends — SILENT unfriend. No notification, ever. */
export async function DELETE(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const { db, userId } = ctx;

    await db
      .from("friendships")
      .delete()
      .eq("id", parsed.data.id)
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
