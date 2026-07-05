import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  requirePro,
  canViewPost,
  checkSocialBurst,
  jsonError,
  json,
} from "@/lib/socialServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  postId: z.string().uuid(),
  kind: z.enum(["clap", "heart", "rocket", "party"]).optional(),
});

/**
 * POST /api/social/react — set (or clear, with no kind) your one reaction.
 * One per person per post: reactions are faces, never a tally.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const { db, userId } = ctx;
    const { postId, kind } = parsed.data;

    const { data: post } = await db
      .from("posts")
      .select("user_id, visibility")
      .eq("id", postId)
      .maybeSingle();
    if (!post || !(await canViewPost(db, userId, post))) {
      return json({ error: "not_found" }, 404);
    }

    if (!kind) {
      await db
        .from("post_reactions")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
      return json({ ok: true });
    }
    await db
      .from("post_reactions")
      .upsert(
        { post_id: postId, user_id: userId, kind },
        { onConflict: "post_id,user_id" },
      );
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
