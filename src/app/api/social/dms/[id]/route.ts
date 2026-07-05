import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  requirePro,
  isBlocked,
  authorCards,
  uploadSocialPhoto,
  signPhotos,
  photoBase64Field,
  checkSocialBurst,
  jsonError,
  json,
} from "@/lib/socialServer";
import { containsCrisisLanguage, CRISIS_SIGNPOST } from "@/lib/safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadThread(
  ctx: Awaited<ReturnType<typeof getSocialContext>>,
  threadId: string,
) {
  const { data: t } = await ctx.db
    .from("dm_threads")
    .select("id, user_a, user_b")
    .eq("id", threadId)
    .maybeSingle();
  if (!t || (t.user_a !== ctx.userId && t.user_b !== ctx.userId)) return null;
  const otherId = t.user_a === ctx.userId ? t.user_b : t.user_a;
  if (await isBlocked(ctx.db, ctx.userId, otherId)) return null;
  return { thread: t, otherId };
}

/** GET /api/social/dms/:id — messages (newest 50, chronological). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    const { id } = await params;
    const loaded = await loadThread(ctx, id);
    if (!loaded) return json({ error: "not_found" }, 404);

    const { data: messages } = await ctx.db
      .from("dm_messages")
      .select("id, sender_id, content, photo_path, created_at")
      .eq("thread_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    const cards = await authorCards(ctx.db, [loaded.otherId]);
    const photoMap = await signPhotos(
      ctx.db,
      (messages ?? []).map((m) => m.photo_path),
    );

    return json({
      name: cards.get(loaded.otherId)?.name ?? "someone",
      messages: (messages ?? []).reverse().map((m) => ({
        id: m.id,
        mine: m.sender_id === ctx.userId,
        content: m.content,
        photoUrl: m.photo_path ? (photoMap.get(m.photo_path) ?? null) : null,
        at: m.created_at,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}

const sendSchema = z.object({
  content: z.string().trim().max(2000).optional().default(""),
  photoBase64: photoBase64Field,
});

/**
 * POST /api/social/dms/:id — send text and/or a photo. Crisis language in a
 * DM still DELIVERS (a friend reaching out must never be silenced) — the
 * sender just also sees the signpost.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    if (!(await checkSocialBurst(ctx)))
      return json({ error: "rate_limited" }, 429);
    const { id } = await params;
    const parsed = sendSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid" }, 400);
    if (!parsed.data.content && !parsed.data.photoBase64) {
      return json({ error: "empty" }, 400);
    }
    const loaded = await loadThread(ctx, id);
    if (!loaded) return json({ error: "not_found" }, 404);

    const photoPath = parsed.data.photoBase64
      ? await uploadSocialPhoto(ctx.db, ctx.userId, parsed.data.photoBase64)
      : null;

    const row: Record<string, unknown> = {
      thread_id: id,
      sender_id: ctx.userId,
      content: parsed.data.content,
    };
    if (photoPath) row.photo_path = photoPath;
    const { error } = await ctx.db.from("dm_messages").insert(row);
    if (error) return json({ error: "failed" }, 500);

    if (parsed.data.content && containsCrisisLanguage(parsed.data.content)) {
      return json({ ok: true, crisis: true, message: CRISIS_SIGNPOST });
    }
    return json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
