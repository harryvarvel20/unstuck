import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  requirePro,
  checkSocialBurst,
  jsonError,
  json,
} from "@/lib/socialServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["slow_start", "frozen"]).nullable(),
  audience: z.enum(["friends", "off"]).default("friends"),
});

/**
 * POST /api/social/status — share (or clear) a struggle status. Friends can
 * only respond with a boost — no comments, no advice pile-on, no pity UI.
 * Statuses quietly expire after 24h on read.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);

    const { error } = await ctx.db.from("social_statuses").upsert(
      {
        user_id: ctx.userId,
        kind: parsed.data.kind,
        audience: parsed.data.audience,
        set_at: parsed.data.kind ? new Date().toISOString() : null,
      },
      { onConflict: "user_id" },
    );
    if (error) return json({ error: "failed" }, 500);
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

/** GET — own current status (for the toggle UI). */
export async function GET(): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    const { data } = await ctx.db
      .from("social_statuses")
      .select("kind, audience, set_at")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    const fresh =
      data?.set_at &&
      Date.now() - new Date(data.set_at).getTime() < 24 * 60 * 60 * 1000;
    return json({
      kind: fresh ? (data?.kind ?? null) : null,
      audience: data?.audience ?? "friends",
    });
  } catch (err) {
    return jsonError(err);
  }
}
