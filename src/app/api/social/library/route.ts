import { NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";
import { json, signPhotos } from "@/lib/socialServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/social/library — the public method library. Method-first: the
 * playbook is the headline, the person is a footnote. Deliberately viewable
 * by FREE users too ("try this myself" is never paywalled) — participation
 * (posting/reacting) is what's Pro. Finite, reverse-chronological, no
 * trending, no rankings.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const db = getServiceClient();
  if (!db) return json({ error: "unavailable" }, 503);

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const tag = (req.nextUrl.searchParams.get("tag") ?? "").trim().slice(0, 24);

  let query = db
    .from("posts")
    .select(
      "id, user_id, win_text, caption, tags, playbook, anon, photo_path, created_at",
    )
    .eq("visibility", "public")
    .eq("space", "main") // parent-space posts never enter the public library
    .eq("flagged", false)
    .not("playbook", "is", null)
    .order("created_at", { ascending: false })
    .limit(30);
  if (tag) query = query.contains("tags", [tag.toLowerCase()]);
  if (q) query = query.ilike("win_text", `%${q}%`);

  const { data: posts } = await query;

  const authorIds = (posts ?? []).filter((p) => !p.anon).map((p) => p.user_id);
  const cards = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data } = await db
      .from("social_profiles")
      .select("user_id, handle, display_name")
      .in("user_id", Array.from(new Set(authorIds)));
    for (const p of data ?? []) {
      cards.set(p.user_id, p.display_name || p.handle);
    }
  }

  const photoMap = await signPhotos(
    db,
    (posts ?? []).map((p) => p.photo_path),
  );

  return json({
    entries: (posts ?? []).map((p) => ({
      id: p.id,
      winText: p.win_text,
      caption: p.caption,
      tags: p.tags ?? [],
      playbook: p.playbook,
      photoUrl: p.photo_path ? (photoMap.get(p.photo_path) ?? null) : null,
      author: p.anon
        ? "someone with ADHD"
        : (cards.get(p.user_id) ?? "someone"),
      createdAt: p.created_at,
    })),
  });
}
