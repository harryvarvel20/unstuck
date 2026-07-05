import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  requirePro,
  authorCards,
  uploadSocialPhoto,
  signPhotos,
  photoBase64Field,
  checkSocialBurst,
  jsonError,
  json,
} from "@/lib/socialServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * GET /api/social/challenges — my challenges with COLLECTIVE progress only.
 * One shared bar per challenge. Per-person contributions are never surfaced
 * — the group total is the only number, and it only goes up.
 */
export async function GET(): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    const { db, userId } = ctx;

    const { data: memberships } = await db
      .from("challenge_members")
      .select("challenge_id")
      .eq("user_id", userId);
    const ids = (memberships ?? []).map((m) => m.challenge_id);
    if (ids.length === 0) return json({ challenges: [] });

    const { data: challenges } = await db
      .from("challenges")
      .select("id, name, code, target, ends_at, owner_id")
      .in("id", ids);

    const shaped = [];
    for (const c of challenges ?? []) {
      const [{ count: ticks }, { data: members }, { count: myTicksToday }] =
        await Promise.all([
          db
            .from("challenge_ticks")
            .select("id", { count: "exact", head: true })
            .eq("challenge_id", c.id),
          db
            .from("challenge_members")
            .select("user_id")
            .eq("challenge_id", c.id),
          db
            .from("challenge_ticks")
            .select("id", { count: "exact", head: true })
            .eq("challenge_id", c.id)
            .eq("user_id", userId)
            .gte(
              "created_at",
              new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
            ),
        ]);
      const memberIds = (members ?? []).map((m) => m.user_id);
      const cards = await authorCards(db, memberIds);

      // A small shared photo wall — recent moments the group added.
      const { data: photoTicks } = await db
        .from("challenge_ticks")
        .select("user_id, photo_path, caption, created_at")
        .eq("challenge_id", c.id)
        .not("photo_path", "is", null)
        .order("created_at", { ascending: false })
        .limit(12);
      const photoMap = await signPhotos(
        db,
        (photoTicks ?? []).map((t) => t.photo_path),
      );

      shaped.push({
        id: c.id,
        name: c.name,
        code: c.code,
        target: c.target,
        done: ticks ?? 0,
        endsAt: c.ends_at,
        ended: new Date(c.ends_at).getTime() < Date.now(),
        tickedToday: (myTicksToday ?? 0) > 0,
        members: memberIds.map((m) =>
          m === userId ? "you" : (cards.get(m)?.name ?? "someone"),
        ),
        photos: (photoTicks ?? [])
          .filter((t) => t.photo_path && photoMap.get(t.photo_path))
          .map((t) => ({
            url: photoMap.get(t.photo_path as string) as string,
            caption: t.caption as string | null,
            who:
              t.user_id === userId
                ? "you"
                : (cards.get(t.user_id)?.name ?? "someone"),
          })),
      });
    }
    return json({ challenges: shaped });
  } catch (err) {
    return jsonError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  target: z.number().int().min(5).max(500).default(20),
  days: z.number().int().min(1).max(31).default(7),
});
const joinSchema = z.object({ code: z.string().trim().min(4).max(12) });
const tickSchema = z.object({
  challengeId: z.string().uuid(),
  photoBase64: photoBase64Field,
  caption: z.string().trim().max(140).optional(),
});
const leaveSchema = z.object({
  challengeId: z.string().uuid(),
  leave: z.literal(true),
});

/** POST — create, join by code, or tick ("did my one tiny thing today"). */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const body = await req.json().catch(() => ({}));
    const { db, userId } = ctx;

    const create = createSchema.safeParse(body);
    if (create.success && !("code" in body) && !("challengeId" in body)) {
      const endsAt = new Date(
        Date.now() + create.data.days * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data: made, error } = await db
        .from("challenges")
        .insert({
          owner_id: userId,
          name: create.data.name,
          code: makeCode(),
          target: create.data.target,
          ends_at: endsAt,
        })
        .select("id, code")
        .maybeSingle();
      if (error || !made) return json({ error: "failed" }, 500);
      await db
        .from("challenge_members")
        .insert({ challenge_id: made.id, user_id: userId });
      return json({ ok: true, id: made.id, code: made.code });
    }

    const join = joinSchema.safeParse(body);
    if (join.success) {
      const { data: c } = await db
        .from("challenges")
        .select("id, ends_at")
        .eq("code", join.data.code.toLowerCase())
        .maybeSingle();
      if (!c || new Date(c.ends_at).getTime() < Date.now()) {
        return json({ error: "not_found" }, 404);
      }
      await db
        .from("challenge_members")
        .upsert(
          { challenge_id: c.id, user_id: userId },
          { onConflict: "challenge_id,user_id" },
        );
      return json({ ok: true, id: c.id });
    }

    const tick = tickSchema.safeParse(body);
    if (tick.success) {
      const { data: member } = await db
        .from("challenge_members")
        .select("challenge_id")
        .eq("challenge_id", tick.data.challengeId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!member) return json({ error: "not_found" }, 404);

      // One tick per day per person — steady, not compulsive.
      const midnight = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const { data: todays } = await db
        .from("challenge_ticks")
        .select("id")
        .eq("challenge_id", tick.data.challengeId)
        .eq("user_id", userId)
        .gte("created_at", midnight)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const photoPath = tick.data.photoBase64
        ? await uploadSocialPhoto(db, userId, tick.data.photoBase64)
        : null;

      // Already counted today: don't double-count, but let them attach a
      // photo/caption to the day's contribution.
      if (todays) {
        if (photoPath) {
          await db
            .from("challenge_ticks")
            .update({
              photo_path: photoPath,
              caption: tick.data.caption ?? null,
            })
            .eq("id", todays.id);
        }
        return json({ ok: true, already: true });
      }

      const tickRow: Record<string, unknown> = {
        challenge_id: tick.data.challengeId,
        user_id: userId,
      };
      if (photoPath) {
        tickRow.photo_path = photoPath;
        tickRow.caption = tick.data.caption ?? null;
      }
      await db.from("challenge_ticks").insert(tickRow);
      return json({ ok: true });
    }

    return json({ error: "invalid" }, 400);
  } catch (err) {
    return jsonError(err);
  }
}

/** DELETE — leave a challenge. Silent, like everything else. */
export async function DELETE(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    const parsed = leaveSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    await ctx.db
      .from("challenge_members")
      .delete()
      .eq("challenge_id", parsed.data.challengeId)
      .eq("user_id", ctx.userId);
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
