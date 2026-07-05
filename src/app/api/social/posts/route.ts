import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  requirePro,
  friendIds,
  blockedSet,
  authorCards,
  uploadSocialPhoto,
  signPhotos,
  photoBase64Field,
  SOCIAL_BUCKET,
  checkSocialBurst,
  jsonError,
  json,
} from "@/lib/socialServer";
import {
  containsCrisisLanguage,
  CRISIS_SIGNPOST,
  looksAbusive,
} from "@/lib/safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/social/posts — the wins feed. Reverse-chronological, FINITE
 * (30 posts, then "you're all caught up"), friends + own posts only.
 * Reactions come back as named faces, never a number to chase.
 */
export async function GET(): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    const { db, userId } = ctx;

    const [friends, blocked] = await Promise.all([
      friendIds(db, userId, { excludeMutedByMe: true }),
      blockedSet(db, userId),
    ]);
    const authors = [userId, ...friends.filter((f) => !blocked.has(f))];

    const { data: posts } = await db
      .from("posts")
      .select(
        "id, user_id, win_text, caption, tags, photo_path, visibility, anon, comments_off, comments_friends_only, playbook, created_at",
      )
      .in("user_id", authors)
      .in("visibility", ["friends", "public"])
      .eq("flagged", false)
      .order("created_at", { ascending: false })
      .limit(30);

    // Own private posts still show to their author.
    const { data: ownPrivate } = await db
      .from("posts")
      .select(
        "id, user_id, win_text, caption, tags, photo_path, visibility, anon, comments_off, comments_friends_only, playbook, created_at",
      )
      .eq("user_id", userId)
      .eq("visibility", "private")
      .order("created_at", { ascending: false })
      .limit(10);

    const all = [...(posts ?? []), ...(ownPrivate ?? [])]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 30);

    const ids = all.map((p) => p.id);
    const reactions: Record<
      string,
      { name: string; kind: string; mine: boolean }[]
    > = {};
    const comments: Record<
      string,
      { id: string; name: string; content: string; mine: boolean }[]
    > = {};

    if (ids.length > 0) {
      const [{ data: rx }, { data: cm }] = await Promise.all([
        db
          .from("post_reactions")
          .select("post_id, user_id, kind")
          .in("post_id", ids),
        db
          .from("post_comments")
          .select("id, post_id, user_id, content, created_at")
          .in("post_id", ids)
          .eq("flagged", false)
          .order("created_at", { ascending: true }),
      ]);
      const peopleIds = [
        ...(rx ?? []).map((r) => r.user_id),
        ...(cm ?? []).map((c) => c.user_id),
      ];
      const cards = await authorCards(db, peopleIds);
      for (const r of rx ?? []) {
        if (blocked.has(r.user_id)) continue;
        (reactions[r.post_id] ??= []).push({
          name:
            r.user_id === userId
              ? "you"
              : (cards.get(r.user_id)?.name ?? "someone"),
          kind: r.kind,
          mine: r.user_id === userId,
        });
      }
      for (const c of cm ?? []) {
        if (blocked.has(c.user_id)) continue;
        const list = (comments[c.post_id] ??= []);
        if (list.length >= 8) continue; // comments stay small by design
        list.push({
          id: c.id,
          name:
            c.user_id === userId
              ? "you"
              : (cards.get(c.user_id)?.name ?? "someone"),
          content: c.content,
          mine: c.user_id === userId,
        });
      }
    }

    const cards = await authorCards(
      db,
      all.map((p) => p.user_id),
    );
    const photoMap = await signPhotos(
      db,
      all.map((p) => p.photo_path),
    );
    return json({
      posts: all.map((p) => ({
        id: p.id,
        mine: p.user_id === userId,
        author:
          p.user_id === userId
            ? "you"
            : (cards.get(p.user_id)?.name ?? "someone"),
        winText: p.win_text,
        caption: p.caption,
        tags: p.tags ?? [],
        photoUrl: p.photo_path ? (photoMap.get(p.photo_path) ?? null) : null,
        visibility: p.visibility,
        commentsOff: p.comments_off,
        playbook: p.playbook,
        createdAt: p.created_at,
        reactions: reactions[p.id] ?? [],
        comments: comments[p.id] ?? [],
      })),
      caughtUp: true, // finite by design — there is no page 2
    });
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
});

/** POST /api/social/posts — share a win. Sharing is ALWAYS explicit. */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const p = parsed.data;

    const combined = `${p.winText} ${p.caption ?? ""}`;
    if (containsCrisisLanguage(combined)) {
      return json({ crisis: true, message: CRISIS_SIGNPOST });
    }

    // Safer default until adulthood confirmed: no public identity.
    let visibility = p.visibility;
    if (visibility === "public" && !ctx.profile.adult_confirmed) {
      visibility = "friends";
    }

    const photoPath = p.photoBase64
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
