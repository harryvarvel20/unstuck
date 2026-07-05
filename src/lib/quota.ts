import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "./supabase/server";
import { getServiceClient } from "./supabaseServer";
import { getClientIp, hashIp } from "./rateLimit";

/** Daily free allowances (Pro = unlimited, gated server-side). */
export const LIMITS = {
  focusPerDay: 1,
  /** Safety cap on lightweight AI calls (check-ins, rescue, re-entry). */
  aiLightPerDay: 60,
} as const;

/**
 * Per-minute burst ceilings — protect the money-spending AI endpoints from
 * rapid-fire abuse even for Pro/unlimited users. Applied to EVERY caller
 * (Pro included), keyed per subject per minute.
 */
export const BURST = {
  breakdown: 8,
  aiLight: 20,
} as const;

export interface RequestIdentity {
  user: { id: string; email: string | null } | null;
  plan: "free" | "pro";
  /** "user:<uuid>" for signed-in, "ip:<hash>" for anonymous. */
  subject: string;
  supabase: SupabaseClient | null;
}

/** Resolve who is calling and what plan they're on. */
export async function getRequestIdentity(
  req: NextRequest,
): Promise<RequestIdentity> {
  const supabase = await createSupabaseServer();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle();
      return {
        user: { id: user.id, email: user.email ?? null },
        plan: profile?.plan === "pro" ? "pro" : "free",
        subject: `user:${user.id}`,
        supabase,
      };
    }
  }
  return {
    user: null,
    plan: "free",
    subject: `ip:${hashIp(getClientIp(req.headers))}`,
    supabase,
  };
}

export interface FeatureQuotaResult {
  allowed: boolean;
  count: number;
  enforced: boolean;
}

/**
 * Consume one unit of a daily feature allowance. Pro users skip counting.
 * Fails OPEN (unenforced) when Supabase isn't configured or errors, so an
 * infra hiccup never blocks a real user.
 */
export async function consumeFeature(
  identity: RequestIdentity,
  feature: string,
  limit: number,
): Promise<FeatureQuotaResult> {
  if (identity.plan === "pro") {
    return { allowed: true, count: 0, enforced: true };
  }
  const service = getServiceClient();
  if (!service) return { allowed: true, count: 0, enforced: false };

  const { data, error } = await service.rpc("consume_feature_usage", {
    p_subject: identity.subject,
    p_feature: feature,
    p_limit: limit,
  });
  if (error) {
    console.error(`consume_feature_usage(${feature}) failed:`, error.message);
    return { allowed: true, count: 0, enforced: false };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    count: Number(row?.current_count ?? 0),
    enforced: true,
  };
}

/**
 * Per-minute burst limiter. Reuses the daily feature counter with a
 * minute-bucketed feature key, so it needs no extra table. Applies to Pro
 * too (this is abuse protection, not a plan limit). Fails open if unconfigured.
 */
export async function checkBurst(
  identity: RequestIdentity,
  name: string,
  perMinute: number,
): Promise<boolean> {
  const service = getServiceClient();
  if (!service) return true;
  const minuteBucket = Math.floor(Date.now() / 60000);
  const { data, error } = await service.rpc("consume_feature_usage", {
    p_subject: identity.subject,
    p_feature: `burst:${name}:${minuteBucket}`,
    p_limit: perMinute,
  });
  if (error) return true; // never block a real user on our infra hiccup
  const row = Array.isArray(data) ? data[0] : data;
  return Boolean(row?.allowed);
}
