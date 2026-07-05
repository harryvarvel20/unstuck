import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  orderPair,
  canViewPost,
  checkSocialBurst,
  jsonError,
  json,
} from "@/lib/socialServer";

/**
 * Security X1 fix: reports used to flip `flagged: true` on the FIRST report,
 * unconditionally, with no check the reporter could even see the content and
 * no rate limit — a single signed-in account (Pro not even required) could
 * instantly suppress any public post/comment platform-wide by guessing/using
 * a known id (e.g. anything visible via the public library), repeatedly.
 * Now: the reporter must be authorised to view the thing they're reporting,
 * every report is still recorded immediately for human review, but automatic
 * hiding only kicks in once a subject accrues DISTINCT_REPORTS_TO_AUTOHIDE
 * unique reporters — a single bad-faith report can no longer nuke content on
 * its own. This is a behavioural change made as a security fix; see
 * CHANGELOG.md.
 */
const DISTINCT_REPORTS_TO_AUTOHIDE = 3;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const blockSchema = z.object({
  action: z.literal("block"),
  userId: z.string().uuid(),
});
const unblockSchema = z.object({
  action: z.literal("unblock"),
  userId: z.string().uuid(),
});
const reportSchema = z.object({
  action: z.literal("report"),
  subjectType: z.enum(["post", "comment", "dm", "profile"]),
  subjectId: z.string().min(1).max(80),
  reason: z.string().trim().max(500).optional(),
});

/**
 * POST /api/social/safety — block, unblock, report. Blocking severs
 * everything instantly (friendship, buddy pair, feed, DMs) and is silent.
 * Reports go to a human review queue; nothing is auto-punished.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    // Deliberately NOT requirePro(ctx) — block/report are safety tools and
    // must never be paywalled. Still rate-limited (applies to every plan).
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const body = await req.json().catch(() => ({}));
    const { db, userId } = ctx;

    const block = blockSchema.safeParse(body);
    if (block.success) {
      const other = block.data.userId;
      if (other === userId) return json({ error: "invalid" }, 400);
      await db
        .from("blocks")
        .upsert(
          { blocker_id: userId, blocked_id: other },
          { onConflict: "blocker_id,blocked_id" },
        );
      const [a, b] = orderPair(userId, other);
      // Sever quietly: friendship, buddy pair. DMs/feed filter on read.
      await db.from("friendships").delete().eq("user_a", a).eq("user_b", b);
      await db.from("buddies").delete().eq("user_a", a).eq("user_b", b);
      return json({ ok: true });
    }

    const unblock = unblockSchema.safeParse(body);
    if (unblock.success) {
      await db
        .from("blocks")
        .delete()
        .eq("blocker_id", userId)
        .eq("blocked_id", unblock.data.userId);
      return json({ ok: true });
    }

    const report = reportSchema.safeParse(body);
    if (report.success) {
      // The reporter must actually be authorised to see what they're
      // reporting — otherwise a guessed/enumerated id lets a stranger
      // suppress content they were never shown in the first place.
      let postId: string | null = null;
      if (report.data.subjectType === "post") {
        postId = report.data.subjectId;
      } else if (report.data.subjectType === "comment") {
        const { data: comment } = await db
          .from("post_comments")
          .select("post_id")
          .eq("id", report.data.subjectId)
          .maybeSingle();
        postId = comment?.post_id ?? null;
      }
      if (postId) {
        const { data: post } = await db
          .from("posts")
          .select("user_id, visibility")
          .eq("id", postId)
          .maybeSingle();
        if (!post || !(await canViewPost(db, userId, post))) {
          return json({ error: "not_found" }, 404);
        }
      }

      // Always record immediately for human review — but a single report no
      // longer auto-hides content. Only once DISTINCT_REPORTS_TO_AUTOHIDE
      // unique people have flagged the same thing does it come down pending
      // review, so one bad-faith report can't unilaterally suppress someone.
      await db.from("reports").insert({
        reporter_id: userId,
        subject_type: report.data.subjectType,
        subject_id: report.data.subjectId,
        reason: report.data.reason || null,
      });

      const { data: reporters } = await db
        .from("reports")
        .select("reporter_id")
        .eq("subject_type", report.data.subjectType)
        .eq("subject_id", report.data.subjectId);
      const distinctReporters = new Set(
        (reporters ?? []).map((r) => r.reporter_id),
      ).size;

      if (distinctReporters >= DISTINCT_REPORTS_TO_AUTOHIDE) {
        if (report.data.subjectType === "post") {
          await db
            .from("posts")
            .update({ flagged: true })
            .eq("id", report.data.subjectId);
        } else if (report.data.subjectType === "comment") {
          await db
            .from("post_comments")
            .update({ flagged: true })
            .eq("id", report.data.subjectId);
        }
      }
      return json({ ok: true });
    }

    return json({ error: "invalid" }, 400);
  } catch (err) {
    return jsonError(err);
  }
}
