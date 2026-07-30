import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createSupabaseServer } from "./supabase/server";
import { getServiceClient } from "./supabaseServer";
import { checkBurst, type RequestIdentity } from "./quota";
import { suggestHandle } from "./username";

/**
 * Server core for the Activity Center (Phase U).
 *
 * ALL social reads and writes flow through API routes that use the service
 * client plus the explicit authorization helpers below — the browser never
 * queries social tables directly (RLS on those tables is own-rows-only as
 * defence in depth). Product law enforced here, not in the UI:
 *  - mutual-accept friendships; silent unfriend (delete, no notification)
 *  - blocks filter both directions everywhere
 *  - visibility checked on every read of someone else's post
 */

export interface SocialProfile {
  user_id: string;
  handle: string;
  /** Normalised lowercase uniqueness key (case-insensitive). */
  handle_key: string;
  /** True once the person has actively chosen their name (Y1). */
  handle_set: boolean;
  handle_changed_at: string | null;
  display_name: string | null;
  default_visibility: "private" | "friends" | "public";
  anon_public: boolean;
  read_receipts: boolean;
  allow_dms: boolean;
  quiet: boolean;
  adult_confirmed: boolean;
  onboarded: boolean;
}

export interface SocialContext {
  db: SupabaseClient;
  userId: string;
  plan: "free" | "pro";
  /** Whether the caller has Parents Mode enabled (gates the parents space). */
  parentsMode: boolean;
  profile: SocialProfile;
}

/** Order a user pair canonically (schema requires user_a < user_b). */
export function orderPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

export class SocialError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Resolve the caller, their plan, and their social profile (auto-created on
 * first touch with a friendly random handle). Throws SocialError on
 * unauthenticated/unconfigured.
 */
export async function getSocialContext(): Promise<SocialContext> {
  const supabase = await createSupabaseServer();
  const db = getServiceClient();
  if (!supabase || !db) throw new SocialError(503, "unavailable");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new SocialError(401, "unauthorized");

  const { data: planRow } = await db
    .from("profiles")
    .select("plan, parents_mode")
    .eq("id", user.id)
    .maybeSingle();
  const plan: "free" | "pro" = planRow?.plan === "pro" ? "pro" : "free";
  const parentsMode = Boolean(planRow?.parents_mode);

  let { data: profile } = await db
    .from("social_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    // First touch: mint a placeholder handle (valid + non-PII). handle_set stays
    // false, so the person is prompted to choose before they can post/comment.
    // Retry on the unlikely collision against the case-insensitive key.
    for (let i = 0; i < 5 && !profile; i++) {
      const h = suggestHandle();
      const { data: created } = await db
        .from("social_profiles")
        .insert({ user_id: user.id, handle: h, handle_key: h })
        .select("*")
        .maybeSingle();
      if (created) profile = created;
    }
    if (!profile) throw new SocialError(500, "profile");
  }

  return {
    db,
    userId: user.id,
    plan,
    parentsMode,
    profile: profile as SocialProfile,
  };
}

/** Participation in the Activity Center is Pro (viewing the public library is not). */
export function requirePro(ctx: SocialContext): void {
  if (ctx.plan !== "pro") throw new SocialError(402, "pro_required");
}

/**
 * Security X1 fix: a shared per-minute write budget for every mutating social
 * endpoint (posts, comments, reactions, DMs, friend requests, buddy actions,
 * challenges, boosts, reports, ...). Previously ONLY the two AI-calling
 * routes (assist, coach) had any throttling — every other write endpoint had
 * none, which is a spam/abuse/join-code-guessing gap. Applies to Pro too
 * (abuse protection, not a plan limit); fails open on infra hiccups so a real
 * user is never blocked by our own outage. Call once, right after
 * requirePro(), in every POST/PUT/DELETE social or parents-tools route.
 */
export async function checkSocialBurst(ctx: SocialContext): Promise<boolean> {
  const identity: RequestIdentity = {
    user: { id: ctx.userId, email: null },
    plan: ctx.plan,
    subject: `user:${ctx.userId}`,
    supabase: null,
  };
  return checkBurst(identity, "socialWrite", 20);
}

/** Same budget for parents-tools routes, which don't go through SocialContext. */
export async function checkParentsBurst(userId: string): Promise<boolean> {
  const identity: RequestIdentity = {
    user: { id: userId, email: null },
    plan: "pro", // parents-tools routes already require Pro before this call
    subject: `user:${userId}`,
    supabase: null,
  };
  return checkBurst(identity, "socialWrite", 20);
}

/** Is there an ACCEPTED friendship between these two users? */
export async function areFriends(
  db: SupabaseClient,
  x: string,
  y: string,
): Promise<boolean> {
  const [a, b] = orderPair(x, y);
  const { data } = await db
    .from("friendships")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .eq("status", "accepted")
    .maybeSingle();
  return Boolean(data);
}

/** Block in EITHER direction severs everything. */
export async function isBlocked(
  db: SupabaseClient,
  x: string,
  y: string,
): Promise<boolean> {
  const { data } = await db
    .from("blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${x},blocked_id.eq.${y}),and(blocker_id.eq.${y},blocked_id.eq.${x})`,
    )
    .limit(1);
  return Boolean(data && data.length > 0);
}

/** All user ids blocked by-or-blocking `userId` (for feed filtering). */
export async function blockedSet(
  db: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await db
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  const out = new Set<string>();
  for (const row of data ?? []) {
    out.add(row.blocker_id === userId ? row.blocked_id : row.blocker_id);
  }
  return out;
}

/** Accepted friend ids, with per-side mute flags honoured. */
export async function friendIds(
  db: SupabaseClient,
  userId: string,
  opts: { excludeMutedByMe?: boolean } = {},
): Promise<string[]> {
  const { data } = await db
    .from("friendships")
    .select("user_a, user_b, muted_by_a, muted_by_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq("status", "accepted");
  const out: string[] = [];
  for (const f of data ?? []) {
    const iAmA = f.user_a === userId;
    if (opts.excludeMutedByMe && (iAmA ? f.muted_by_a : f.muted_by_b)) continue;
    out.push(iAmA ? f.user_b : f.user_a);
  }
  return out;
}

/**
 * May `viewer` see this post? Own posts always; public posts yes (unless
 * blocked); friends posts only for accepted friends.
 */
export async function canViewPost(
  db: SupabaseClient,
  viewer: string | null,
  post: { user_id: string; visibility: string },
): Promise<boolean> {
  if (viewer && viewer === post.user_id) return true;
  if (viewer && (await isBlocked(db, viewer, post.user_id))) return false;
  if (post.visibility === "public") return true;
  if (post.visibility === "friends") {
    if (!viewer) return false;
    return areFriends(db, viewer, post.user_id);
  }
  return false;
}

/** Public-safe author shape: handle/display name only — no ids leak to peers. */
export async function authorCards(
  db: SupabaseClient,
  userIds: string[],
): Promise<Map<string, { handle: string; name: string }>> {
  const out = new Map<string, { handle: string; name: string }>();
  if (userIds.length === 0) return out;
  const { data } = await db
    .from("social_profiles")
    .select("user_id, handle, display_name")
    .in("user_id", Array.from(new Set(userIds)));
  for (const p of data ?? []) {
    out.set(p.user_id, {
      handle: p.handle,
      name: p.display_name || p.handle,
    });
  }
  return out;
}

export function jsonError(err: unknown): Response {
  const status = err instanceof SocialError ? err.status : 500;
  const message = err instanceof SocialError ? err.message : "error";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/* ---- Photos -------------------------------------------------------------
   Private bucket; upload under the owner's folder, serve via short-lived
   signed URLs only after the caller has passed the surrounding
   authorization check. EXIF is already stripped client-side. */

export const SOCIAL_BUCKET = "social-photos";

/** Zod field for an optional inline JPEG (base64, no data: prefix). */
export const photoBase64Field = z.string().min(16).max(1_800_000).optional();

/**
 * Upload one base64 JPEG to the caller's folder. Best-effort: returns the
 * stored path, or null on any failure (a photo hiccup must never sink the
 * post/message itself).
 */
export async function uploadSocialPhoto(
  db: SupabaseClient,
  userId: string,
  base64: string,
): Promise<string | null> {
  try {
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0 || bytes.length > 4_000_000) return null;
    const path = `${userId}/${randomUUID()}.jpg`;
    const { error } = await db.storage
      .from(SOCIAL_BUCKET)
      .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

/** Sign a batch of storage paths → Map<path, signedUrl> (1h expiry). */
export async function signPhotos(
  db: SupabaseClient,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const clean = Array.from(
    new Set(paths.filter((p): p is string => Boolean(p))),
  );
  if (clean.length === 0) return out;
  const { data } = await db.storage
    .from(SOCIAL_BUCKET)
    .createSignedUrls(clean, 3600);
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) out.set(item.path, item.signedUrl);
  }
  return out;
}

/* ---- Post hydration -----------------------------------------------------
   Shared by the feed and search so both return identical, safe post shapes:
   named-face reactions (never a count), a small bounded comment list, a signed
   photo URL, and an author that honours anonymous public posts and blocks. */

export interface RawPost {
  id: string;
  user_id: string;
  win_text: string;
  caption: string | null;
  tags: string[] | null;
  photo_path: string | null;
  visibility: string;
  anon: boolean;
  comments_off: boolean;
  comments_friends_only: boolean;
  playbook: unknown;
  created_at: string;
  space?: string;
}

export interface PostDto {
  id: string;
  mine: boolean;
  author: string;
  winText: string;
  caption: string | null;
  tags: string[];
  photoUrl: string | null;
  visibility: string;
  commentsOff: boolean;
  playbook: unknown;
  createdAt: string;
  space: string;
  reactions: { name: string; kind: string; mine: boolean }[];
  comments: { id: string; name: string; content: string; mine: boolean }[];
}

export const POST_FIELDS =
  "id, user_id, win_text, caption, tags, photo_path, visibility, anon, comments_off, comments_friends_only, playbook, space, created_at";

export async function hydratePosts(
  db: SupabaseClient,
  rows: RawPost[],
  userId: string,
  blocked: Set<string>,
): Promise<PostDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((p) => p.id);

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
    ...rows.map((p) => p.user_id),
  ];
  const cards = await authorCards(db, peopleIds);
  const photoMap = await signPhotos(
    db,
    rows.map((p) => p.photo_path),
  );

  const reactions: Record<
    string,
    { name: string; kind: string; mine: boolean }[]
  > = {};
  const comments: Record<
    string,
    { id: string; name: string; content: string; mine: boolean }[]
  > = {};

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

  return rows.map((p) => ({
    id: p.id,
    mine: p.user_id === userId,
    author:
      p.user_id === userId
        ? "you"
        : p.anon
          ? "someone with ADHD"
          : (cards.get(p.user_id)?.name ?? "someone"),
    winText: p.win_text,
    caption: p.caption,
    tags: p.tags ?? [],
    photoUrl: p.photo_path ? (photoMap.get(p.photo_path) ?? null) : null,
    visibility: p.visibility,
    commentsOff: p.comments_off,
    playbook: p.playbook,
    createdAt: p.created_at,
    space: p.space ?? "main",
    reactions: reactions[p.id] ?? [],
    comments: comments[p.id] ?? [],
  }));
}
