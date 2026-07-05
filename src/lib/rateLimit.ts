import { createHash } from "crypto";
import { getServiceClient } from "./supabaseServer";
import { ANON_DAILY_LIMIT } from "./constants";

// Re-export so existing server imports of ANON_DAILY_LIMIT from this module
// keep working.
export { ANON_DAILY_LIMIT };

// A fixed pepper so IP hashes are not trivially reversible. This is a privacy
// measure (we never store raw IPs), not a security secret.
const IP_PEPPER = "unstuck:anon:v1";

/** Best-effort extraction of the caller's IP from proxy headers. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-vercel-forwarded-for")?.trim() ||
    "unknown"
  );
}

/** One-way hash of the IP — we never persist the raw address. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${IP_PEPPER}:${ip}`).digest("hex");
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  /** False when Supabase isn't wired up yet — server enforcement is skipped. */
  enforced: boolean;
}

/**
 * Atomically checks and (if under the limit) increments today's anonymous
 * usage for this IP hash. When Supabase isn't configured we fail OPEN so the
 * app still works locally; the client-side localStorage counter still applies.
 */
export async function consumeAnonQuota(
  ipHash: string,
): Promise<RateLimitResult> {
  const supabase = getServiceClient();
  if (!supabase) {
    return {
      allowed: true,
      count: 0,
      limit: ANON_DAILY_LIMIT,
      enforced: false,
    };
  }

  const { data, error } = await supabase.rpc("consume_anon_usage", {
    p_ip_hash: ipHash,
    p_limit: ANON_DAILY_LIMIT,
  });

  if (error) {
    // If the counter is unavailable, don't hard-block a paying-intent user.
    // Log for observability; fail open but mark unenforced.
    console.error("consume_anon_usage failed:", error.message);
    return {
      allowed: true,
      count: 0,
      limit: ANON_DAILY_LIMIT,
      enforced: false,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const allowed = Boolean(row?.allowed);
  const count = Number(row?.current_count ?? 0);

  return { allowed, count, limit: ANON_DAILY_LIMIT, enforced: true };
}

/**
 * Atomically checks + increments a signed-in user's daily usage via the
 * service-role RPC. Fails open (unenforced) when Supabase isn't configured.
 */
export async function consumeUserQuota(
  userId: string,
): Promise<RateLimitResult> {
  const supabase = getServiceClient();
  if (!supabase) {
    return {
      allowed: true,
      count: 0,
      limit: ANON_DAILY_LIMIT,
      enforced: false,
    };
  }

  const { data, error } = await supabase.rpc("consume_user_usage", {
    p_user_id: userId,
    p_limit: ANON_DAILY_LIMIT,
  });

  if (error) {
    console.error("consume_user_usage failed:", error.message);
    return {
      allowed: true,
      count: 0,
      limit: ANON_DAILY_LIMIT,
      enforced: false,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    count: Number(row?.current_count ?? 0),
    limit: ANON_DAILY_LIMIT,
    enforced: true,
  };
}
