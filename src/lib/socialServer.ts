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
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  const plan: "free" | "pro" = planRow?.plan === "pro" ? "pro" : "free";

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

  return { db, userId: user.id, plan, profile: profile as SocialProfile };
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
