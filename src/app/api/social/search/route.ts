import { NextRequest } from "next/server";
import {
  getSocialContext,
  requirePro,
  friendIds,
  blockedSet,
  hydratePosts,
  checkSocialBurst,
  type RawPost,
  jsonError,
  json,
} from "@/lib/socialServer";
import {
  containsCrisisLanguage,
  CRISIS_SIGNPOST,
  childSafetyConcern,
  CHILD_SAFETY_SIGNPOST,
} from "@/lib/safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/social/search?q=…&space=main|parents — full-text + fuzzy search over
 * wins, captions, playbook text and tags. Visibility is enforced INSIDE the
 * search_posts function (service-role only), so a user can only ever match
 * content they're allowed to see (public always; friends only if mutual; own
 * always). Crisis / safeguarding is screened on the query too.
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const { db, userId, parentsMode } = ctx;

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
    const space =
      req.nextUrl.searchParams.get("space") === "parents" ? "parents" : "main";
    if (q.length < 2) return json({ posts: [], query: q });
    if (space === "parents" && !parentsMode)
      return json({ posts: [], query: q });

    // Safeguarding / crisis on the query itself — never returns results.
    if (space === "parents" && childSafetyConcern(q)) {
      return json({ crisis: true, message: CHILD_SAFETY_SIGNPOST });
    }
    if (containsCrisisLanguage(q)) {
      return json({ crisis: true, message: CRISIS_SIGNPOST });
    }

    const [friends, blocked] = await Promise.all([
      friendIds(db, userId, { excludeMutedByMe: true }),
      blockedSet(db, userId),
    ]);

    const { data, error } = await db.rpc("search_posts", {
      p_viewer: userId,
      p_friends: friends,
      p_blocked: Array.from(blocked),
      p_query: q,
      p_space: space,
      p_limit: 30,
    });
    if (error) return json({ posts: [], query: q });

    const posts = await hydratePosts(
      db,
      (data ?? []) as RawPost[],
      userId,
      blocked,
    );
    return json({ posts, query: q });
  } catch (err) {
    return jsonError(err);
  }
}
