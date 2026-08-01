import { NextRequest } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSocialContext,
  requirePro,
  checkSocialBurst,
  jsonError,
  json,
} from "@/lib/socialServer";
import { validateHandle, HANDLE_ERROR_MESSAGE } from "@/lib/username";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHANGE_COOLDOWN_DAYS = 30;
const RESERVE_DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * Is this normalised key free for `me` to take? Taken if another user holds it,
 * or if it's within a reservation window released by someone else. A key I
 * released myself, I may reclaim.
 */
async function keyAvailable(
  db: SupabaseClient,
  key: string,
  me: string,
): Promise<boolean> {
  const { data: existing } = await db
    .from("social_profiles")
    .select("user_id")
    .eq("handle_key", key)
    .maybeSingle();
  if (existing && existing.user_id !== me) return false;

  const { data: reserved } = await db
    .from("handle_reservations")
    .select("released_by, reserved_until")
    .eq("handle_key", key)
    .maybeSingle();
  if (
    reserved &&
    new Date(reserved.reserved_until).getTime() > Date.now() &&
    reserved.released_by !== me
  ) {
    return false;
  }
  return true;
}

/** GET /api/social/handle?handle=… — live availability + validation feedback. */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);

    const raw = (req.nextUrl.searchParams.get("handle") ?? "").slice(0, 60);
    const v = validateHandle(raw);
    if (!v.ok) {
      return json({ available: false, error: HANDLE_ERROR_MESSAGE[v.error] });
    }
    // My current handle always reads as "available" (so the change form is calm).
    if (v.key === ctx.profile.handle_key) {
      return json({ available: true, handle: v.handle, current: true });
    }
    const available = await keyAvailable(ctx.db, v.key, ctx.userId);
    return json({
      available,
      handle: v.handle,
      error: available ? undefined : "That name is taken — try another.",
    });
  } catch (err) {
    return jsonError(err);
  }
}

const setSchema = z.object({ handle: z.string().min(1).max(60) });

/** POST /api/social/handle — set or change the name. Race-safe; rate-limited. */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);

    const parsed = setSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);

    const v = validateHandle(parsed.data.handle);
    if (!v.ok) return json({ error: HANDLE_ERROR_MESSAGE[v.error] }, 400);

    const { db, userId, profile } = ctx;
    const isChange = profile.handle_set;

    // No-op: already yours.
    if (v.key === profile.handle_key && isChange) {
      return json({ ok: true, handle: v.handle });
    }

    // Rate-limit real changes (not the first-time set).
    if (isChange && profile.handle_changed_at) {
      const since = Date.now() - new Date(profile.handle_changed_at).getTime();
      const remaining = CHANGE_COOLDOWN_DAYS * DAY_MS - since;
      if (remaining > 0) {
        return json(
          {
            error: `You can change your name again in ${Math.ceil(
              remaining / DAY_MS,
            )} days.`,
            code: "too_soon",
          },
          429,
        );
      }
    }

    if (!(await keyAvailable(db, v.key, userId))) {
      return json(
        { error: "That name is taken — try another.", code: "taken" },
        409,
      );
    }

    const oldKey = profile.handle_key;
    const { error } = await db
      .from("social_profiles")
      .update({
        handle: v.handle,
        handle_key: v.key,
        handle_set: true,
        handle_changed_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      // Unique-violation race: someone claimed it a moment ago.
      if ((error as { code?: string }).code === "23505") {
        return json(
          { error: "That name was just taken — try another.", code: "taken" },
          409,
        );
      }
      return json({ error: "failed" }, 500);
    }

    // Housekeeping (Z7): drop reservations whose cool-down has elapsed, so the
    // table can't grow unboundedly and expired names become claimable again.
    // Opportunistic and best-effort — never blocks the user's rename.
    await db
      .from("handle_reservations")
      .delete()
      .lt("reserved_until", new Date().toISOString());

    // Reserve the freed handle so it can't be grabbed for impersonation, and
    // clear any reservation I held on the name I've just reclaimed.
    if (oldKey && oldKey !== v.key) {
      await db.from("handle_reservations").upsert(
        {
          handle_key: oldKey,
          released_by: userId,
          reserved_until: new Date(
            Date.now() + RESERVE_DAYS * DAY_MS,
          ).toISOString(),
        },
        { onConflict: "handle_key" },
      );
      await db
        .from("handle_reservations")
        .delete()
        .eq("handle_key", v.key)
        .eq("released_by", userId);
    }

    return json({ ok: true, handle: v.handle, changed: isChange });
  } catch (err) {
    return jsonError(err);
  }
}
