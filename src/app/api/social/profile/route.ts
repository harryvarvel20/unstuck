import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  checkSocialBurst,
  jsonError,
  json,
} from "@/lib/socialServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/social/profile — own social identity (auto-created). */
export async function GET(): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    const { profile, plan } = ctx;

    // A tiny inbox summary for the Activity landing (no red badges — words).
    const { count: pendingIn } = await ctx.db
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .or(`user_a.eq.${ctx.userId},user_b.eq.${ctx.userId}`)
      .neq("requested_by", ctx.userId);
    const { count: boostsUnseen } = await ctx.db
      .from("boosts")
      .select("id", { count: "exact", head: true })
      .eq("to_user", ctx.userId)
      .eq("seen", false);

    return json({
      profile: {
        handle: profile.handle,
        displayName: profile.display_name,
        defaultVisibility: profile.default_visibility,
        anonPublic: profile.anon_public,
        readReceipts: profile.read_receipts,
        allowDms: profile.allow_dms,
        quiet: profile.quiet,
        adultConfirmed: profile.adult_confirmed,
        onboarded: profile.onboarded,
      },
      plan,
      pendingRequests: pendingIn ?? 0,
      unseenBoosts: boostsUnseen ?? 0,
    });
  } catch (err) {
    return jsonError(err);
  }
}

const patchSchema = z.object({
  displayName: z.string().trim().max(40).optional(),
  defaultVisibility: z.enum(["private", "friends", "public"]).optional(),
  anonPublic: z.boolean().optional(),
  readReceipts: z.boolean().optional(),
  allowDms: z.boolean().optional(),
  quiet: z.boolean().optional(),
  adultConfirmed: z.boolean().optional(),
  onboarded: z.boolean().optional(),
});

/** PATCH /api/social/profile — settings (all opt-in, all reversible). */
export async function PATCH(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    const p = parsed.data;

    const update: Record<string, unknown> = {};
    if (p.displayName !== undefined)
      update.display_name = p.displayName || null;
    if (p.anonPublic !== undefined) update.anon_public = p.anonPublic;
    if (p.readReceipts !== undefined) update.read_receipts = p.readReceipts;
    if (p.allowDms !== undefined) update.allow_dms = p.allowDms;
    if (p.quiet !== undefined) update.quiet = p.quiet;
    if (p.adultConfirmed === true) update.adult_confirmed = true;
    if (p.onboarded === true) update.onboarded = true;
    if (p.defaultVisibility !== undefined) {
      // Safer default until age confirmed: public identity stays off.
      const wantsPublic = p.defaultVisibility === "public";
      const adult = p.adultConfirmed === true || ctx.profile.adult_confirmed;
      update.default_visibility =
        wantsPublic && !adult ? "friends" : p.defaultVisibility;
    }

    const { error } = await ctx.db
      .from("social_profiles")
      .update(update)
      .eq("user_id", ctx.userId);
    if (error) return json({ error: "failed" }, 500);
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
