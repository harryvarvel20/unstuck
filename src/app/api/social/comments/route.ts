import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  requirePro,
  canViewPost,
  areFriends,
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

const createSchema = z.object({
  postId: z.string().uuid(),
  content: z.string().trim().min(1).max(400),
});

/** POST /api/social/comments — bounded, kind by design. */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const { db, userId } = ctx;
    const { postId, content } = parsed.data;

    if (containsCrisisLanguage(content)) {
      return json({ crisis: true, message: CRISIS_SIGNPOST });
    }

    const { data: post } = await db
      .from("posts")
      .select("user_id, visibility, comments_off, comments_friends_only")
      .eq("id", postId)
      .maybeSingle();
    if (!post || !(await canViewPost(db, userId, post))) {
      return json({ error: "not_found" }, 404);
    }
    if (post.comments_off) return json({ error: "comments_off" }, 403);
    if (
      post.comments_friends_only &&
      post.user_id !== userId &&
      !(await areFriends(db, userId, post.user_id))
    ) {
      return json({ error: "friends_only" }, 403);
    }

    const { data: created, error } = await db
      .from("post_comments")
      .insert({
        post_id: postId,
        user_id: userId,
        content,
        flagged: looksAbusive(content),
      })
      .select("id")
      .maybeSingle();
    if (error || !created) return json({ error: "failed" }, 500);
    return json({ ok: true, id: created.id });
  } catch (err) {
    return jsonError(err);
  }
}

const deleteSchema = z.object({ id: z.string().uuid() });

/** DELETE — remove your own comment, or any comment on your own post. */
export async function DELETE(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const { db, userId } = ctx;

    const { data: c } = await db
      .from("post_comments")
      .select("id, user_id, post_id")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (!c) return json({ ok: true });

    let allowed = c.user_id === userId;
    if (!allowed) {
      const { data: post } = await db
        .from("posts")
        .select("user_id")
        .eq("id", c.post_id)
        .maybeSingle();
      allowed = post?.user_id === userId;
    }
    if (!allowed) return json({ error: "not_found" }, 404);

    await db.from("post_comments").delete().eq("id", c.id);
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
