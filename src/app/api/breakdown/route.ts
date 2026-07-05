import { NextRequest } from "next/server";
import { buildSystemPrompt, buildUserContent } from "@/lib/gemini";
import { streamGeminiJson } from "@/lib/geminiStream";
import { breakdownRequestSchema } from "@/lib/validation";
import {
  consumeAnonQuota,
  consumeUserQuota,
  ANON_DAILY_LIMIT,
  type RateLimitResult,
} from "@/lib/rateLimit";
import { getRequestIdentity, checkBurst, BURST } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  // --- 1. Parse + validate input ------------------------------------------
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request", message: "Invalid request." }, 400);
  }

  const parsed = breakdownRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Please check your input.";
    return json({ error: "invalid_input", message }, 400);
  }
  const { input, mode } = parsed.data;

  // --- 2. Rate limits (server-enforced) -----------------------------------
  // Signed-in users are limited per-user (Pro = unlimited); anonymous users
  // per hashed IP. A per-minute burst ceiling applies to everyone (incl. Pro)
  // because this endpoint spends real money.
  const failOpen: RateLimitResult = {
    allowed: true,
    count: 0,
    limit: ANON_DAILY_LIMIT,
    enforced: false,
  };

  let quota: RateLimitResult = failOpen;
  try {
    const identity = await getRequestIdentity(req);

    if (!(await checkBurst(identity, "breakdown", BURST.breakdown))) {
      return json(
        {
          error: "rate_limited",
          message: "Slow down a moment — try again in a few seconds.",
        },
        429,
      );
    }

    if (identity.plan === "pro") {
      quota = { allowed: true, count: 0, limit: Infinity, enforced: true };
    } else if (identity.user) {
      quota = await consumeUserQuota(identity.user.id);
    } else {
      quota = await consumeAnonQuota(identity.subject.replace(/^ip:/, ""));
    }
  } catch (err) {
    console.error("rate limit error:", err);
    quota = failOpen; // Don't block a real user on our infra hiccup.
  }

  if (!quota.allowed) {
    return json(
      {
        error: "limit_reached",
        message: "You've used your free breakdowns for today.",
        limit: quota.limit,
      },
      429,
    );
  }

  // --- 3. Stream the breakdown back as it's generated ----------------------
  try {
    const res = streamGeminiJson({
      system: buildSystemPrompt({ mode, input }),
      user: buildUserContent(input),
      maxTokens: 2048,
    });
    res.headers.set("x-quota-enforced", String(quota.enforced));
    return res;
  } catch {
    return json(
      {
        error: "server_config",
        message: "We're having a hiccup on our side. Please try again shortly.",
      },
      500,
    );
  }
}
