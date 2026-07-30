import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  requirePro,
  friendIds,
  blockedSet,
  hydratePosts,
  uploadSocialPhoto,
  photoBase64Field,
  SOCIAL_BUCKET,
  POST_FIELDS,
  type RawPost,
  checkSocialBurst,
  jsonError,
  json,
} from "@/lib/socialServer";
import {
  containsCrisisLanguage,
  CRISIS_SIGNPOST,
  childSafetyConcern,
  CHILD_SAFETY_SIGNPOST,
  looksAbusive,
} from "@/lib/safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Scope = "friends" | "public" | "just_me";

/**
 * GET /api/social/posts?scope=friends|public|just_me&space=main|parents
 *
 * Reverse-chronological, FINITE (30 then "you're all caught up"). Scope is
 * enforced SERVER-SIDE against explicit visibility filters (never a client
 * filter over a wider set):
 *  - friends  = wins shared WITH you by accepted mutual friends
 *  - public   = everyone's public wins (Y5.1)
 *  - just_me  = only your own posts, private ones included (your journal)
 * The parents space (Y4) is only visible with Parents Mode on.
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    const { db, userId, parentsMode } = ctx;

    const rawScope = req.nextUrl.searchParams.get("scope");
    const scope: Scope =
      rawScope === "public" || rawScope === "just_me" ? rawScope : "friends";
    const space =
      req.nextUrl.searchParams.get("space") === "parents" ? "parents" : "main";

    if (space === "parents" && !parentsMode) {
      return json({ posts: [], caughtUp: true, scope, space });
    }

    const blocked = await blockedSet(db, userId);

    let query = db
      .from("posts")
      .select(POST_FIELDS)
      .eq("space", space)
      .eq("flagged", false)
      .order("created_at", { ascending: false })
      .limit(30);

    if (scope === "just_me") {
      query = query.eq("user_id", userId); // your journal: every visibility
    } else if (scope === "friends") {
      const friends = (
        await friendIds(db, userId, { excludeMutedByMe: true })
      ).filter((f) => !blocked.has(f));
      if (friends.length === 0) {
        return json({ posts: [], caughtUp: true, scope, space });
      }
      query = query
        .in("user_id", friends)
        .in("visibility", ["friends", "public"]);
    } else {
      // public: everyone's public wins
      query = query.eq("visibility", "public");
    }

    const { data: rows } = await query;
    let list = (rows ?? []) as RawPost[];
    if (scope === "public") list = list.filter((p) => !blocked.has(p.user_id));

    const posts = await hydratePosts(db, list, userId, blocked);
    return json({ posts, caughtUp: true, scope, space });
  } catch (err) {
    return jsonError(err);
  }
}

const playbookSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        minutes: z.number().int().min(1).max(240).optional(),
      }),
    )
    .min(1)
    .max(12),
  tool: z.string().trim().max(60).optional(),
  timeTaken: z.string().trim().max(40).optional(),
  whatWorked: z.string().trim().max(400).optional(),
});

const createSchema = z.object({
  winText: z.string().trim().min(1).max(300),
  caption: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(5).default([]),
  visibility: z.enum(["private", "friends", "public"]).default("friends"),
  anon: z.boolean().default(false),
  commentsOff: z.boolean().default(false),
  playbook: playbookSchema.nullish(),
  photoBase64: photoBase64Field,
  space: z.enum(["main", "parents"]).default("main"),
});

/** POST /api/social/posts — share a win. Sharing is ALWAYS explicit. */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!ctx.profile.handle_set) return json({ error: "handle_required" }, 409);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const p = parsed.data;

    // Parents space (Y4): gated by Parents Mode, higher child-safety bar.
    if (p.space === "parents" && !ctx.parentsMode) {
      return json({ error: "parents_mode_required" }, 403);
    }

    const combined = `${p.winText} ${p.caption ?? ""}`;
    // Safeguarding first on parent posts (routes to child + adult resources),
    // then the general crisis gate — both free, never AI/social output.
    if (p.space === "parents" && childSafetyConcern(combined)) {
      return json({ crisis: true, message: CHILD_SAFETY_SIGNPOST });
    }
    if (containsCrisisLanguage(combined)) {
      return json({ crisis: true, message: CRISIS_SIGNPOST });
    }

    // Safer default until adulthood confirmed: no public identity.
    let visibility = p.visibility;
    if (visibility === "public" && !ctx.profile.adult_confirmed) {
      visibility = "friends";
    }

    // Child-safety hard rule: parent posts carry NO photos (no child faces).
    const photoPath =
      p.space !== "parents" && p.photoBase64
        ? await uploadSocialPhoto(ctx.db, ctx.userId, p.photoBase64)
        : null;

    const { data: created, error } = await ctx.db
      .from("posts")
      .insert({
        user_id: ctx.userId,
        win_text: p.winText,
        caption: p.caption || null,
        tags: p.tags.map((t) => t.toLowerCase()),
        visibility,
        anon: visibility === "public" ? p.anon : false,
        comments_off: p.commentsOff,
        playbook: p.playbook ?? null,
        photo_path: photoPath,
        space: p.space,
        // Parent content gets a higher moderation bar (surfaced for review).
        flagged: looksAbusive(combined),
      })
      .select("id")
      .maybeSingle();
    if (error || !created) return json({ error: "failed" }, 500);
    return json({ ok: true, id: created.id, visibility });
  } catch (err) {
    return jsonError(err);
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  visibility: z.enum(["private", "friends", "public"]),
});

/** PATCH — change visibility any time (removal from feeds is immediate). */
export async function PATCH(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const visibility =
      parsed.data.visibility === "public" && !ctx.profile.adult_confirmed
        ? "friends"
        : parsed.data.visibility;
    await ctx.db
      .from("posts")
      .update({ visibility })
      .eq("id", parsed.data.id)
      .eq("user_id", ctx.userId);
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

const deleteSchema = z.object({ id: z.string().uuid() });

/** DELETE — your win, your call. Gone everywhere at once. */
export async function DELETE(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);

    // Clean up the stored photo too (best-effort).
    const { data: doomed } = await ctx.db
      .from("posts")
      .select("photo_path")
      .eq("id", parsed.data.id)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (doomed?.photo_path) {
      await ctx.db.storage.from(SOCIAL_BUCKET).remove([doomed.photo_path]);
    }

    await ctx.db
      .from("posts")
      .delete()
      .eq("id", parsed.data.id)
      .eq("user_id", ctx.userId);
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
